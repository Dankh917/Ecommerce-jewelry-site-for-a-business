import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { Link, useSearchParams } from "react-router-dom";
import Header from "../components/Header";
import { resetPassword } from "../api/auth";
import { validatePassword } from "../utils/passwordPolicy";

export default function ResetPasswordPage() {
    const [params] = useSearchParams();
    const token = useMemo(() => params.get("token") ?? "", [params]);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
    const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(
        null
    );
    const [submitting, setSubmitting] = useState(false);

    const disabled = !token;

    const onSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (disabled) return;

        setStatus(null);
        const validationErrors = validatePassword(newPassword);
        setPasswordErrors(validationErrors);
        if (validationErrors.length > 0) {
            setStatus({ type: "error", message: "Please choose a password that meets the requirements." });
            return;
        }

        if (newPassword !== confirmPassword) {
            setStatus({ type: "error", message: "Passwords do not match." });
            return;
        }

        setSubmitting(true);
        try {
            const message = await resetPassword({ token, newPassword });
            setStatus({ type: "success", message });
            setNewPassword("");
            setConfirmPassword("");
        } catch (error) {
            if (isAxiosError(error)) {
                const serverMessage =
                    (typeof error.response?.data === "string"
                        ? error.response.data
                        : error.response?.data?.message) ||
                    error.message;
                setStatus({ type: "error", message: serverMessage });
            } else {
                const message = error instanceof Error ? error.message : "Request failed";
                setStatus({ type: "error", message });
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#f3f6f7] via-[#eef3f4] to-[#6B8C8E] bg-fixed flex flex-col">
            <Header />
            <main className="flex-grow flex items-center justify-center p-4">
                <form
                    onSubmit={onSubmit}
                    className="bg-white/90 rounded-lg shadow-md p-6 w-full max-w-md space-y-4"
                >
                    <h1 className="text-2xl font-bold text-center" style={{ color: "#6B8C8E" }}>
                        Reset Password
                    </h1>
                    {!token && (
                        <div className="text-sm bg-red-50 text-red-700 px-3 py-2 rounded-md">
                            The reset link is missing or invalid. Please request a new one.
                        </div>
                    )}
                    <p className="text-sm text-gray-600 text-center">
                        Choose a new password for your EDTArt account. Make sure it’s something secure.
                    </p>
                    {status && (
                        <div
                            className={`text-sm rounded-md px-3 py-2 ${
                                status.type === "success"
                                    ? "bg-green-50 text-green-700"
                                    : "bg-red-50 text-red-700"
                            }`}
                        >
                            {status.message}
                        </div>
                    )}
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">New password</span>
                        </label>
                        <input
                            type="password"
                            className="input input-bordered w-full"
                            value={newPassword}
                            onChange={(e) => {
                                const value = e.target.value;
                                setNewPassword(value);
                                setPasswordErrors(validatePassword(value));
                            }}
                            required
                            disabled={disabled}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Use at least 8 characters and include a number.
                        </p>
                        {passwordErrors.length > 0 && (
                            <ul className="mt-2 text-xs text-red-600 space-y-1">
                                {passwordErrors.map((msg) => (
                                    <li key={msg}>{msg}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Confirm password</span>
                        </label>
                        <input
                            type="password"
                            className="input input-bordered w-full"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            disabled={disabled}
                        />
                    </div>
                    <button
                        type="submit"
                        className="btn w-full text-white"
                        style={{ backgroundColor: "#6B8C8E" }}
                        disabled={submitting || disabled}
                    >
                        {submitting ? "Resetting..." : "Reset password"}
                    </button>
                    <p className="text-sm text-center">
                        Return to{" "}
                        <Link to="/login" className="underline">
                            login
                        </Link>
                        .
                    </p>
                </form>
            </main>
        </div>
    );
}
