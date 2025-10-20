import { useState } from "react";
import { isAxiosError } from "axios";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import { forgotPassword } from "../api/auth";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(
        null
    );
    const [submitting, setSubmitting] = useState(false);

    const onSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setStatus(null);
        setSubmitting(true);
        try {
            const message = await forgotPassword(email);
            setStatus({ type: "success", message });
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
                        Forgot Password
                    </h1>
                    <p className="text-sm text-gray-600 text-center">
                        Enter your email address and we’ll send you a link to reset your EDTArt password.
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
                            <span className="label-text">Email</span>
                        </label>
                        <input
                            type="email"
                            className="input input-bordered w-full"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="btn w-full text-white"
                        style={{ backgroundColor: "#6B8C8E" }}
                        disabled={submitting}
                    >
                        {submitting ? "Sending..." : "Send reset link"}
                    </button>
                    <p className="text-sm text-center">
                        Remembered it?{" "}
                        <Link to="/login" className="underline">
                            Back to login
                        </Link>
                    </p>
                </form>
            </main>
        </div>
    );
}
