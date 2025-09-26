import { useState } from "react";
import { isAxiosError } from "axios";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { register } from "../api/auth";
import { validatePassword } from "../utils/passwordPolicy";

export default function RegisterPage() {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
    const navigate = useNavigate();

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const validationErrors = validatePassword(password);
        setPasswordErrors(validationErrors);
        if (validationErrors.length > 0) {
            setError("Please fix the highlighted password issues.");
            return;
        }
        try {
            await register({ username, email, password });
            navigate("/login");
        } catch (e: unknown) {
            if (isAxiosError(e)) {
                const serverMessage =
                    (typeof e.response?.data === "string"
                        ? e.response.data
                        : e.response?.data?.message) ||
                    e.message;
                setError(serverMessage ?? "Registration failed");
            } else {
                const message = e instanceof Error ? e.message : "Registration failed";
                setError(message);
            }
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#f3f6f7] via-[#eef3f4] to-[#6B8C8E] bg-fixed flex flex-col">
            <Header />
            <main className="flex-grow flex items-center justify-center p-4">
                <form onSubmit={onSubmit} className="bg-white/90 rounded-lg shadow-md p-6 w-full max-w-md space-y-4">
                    <h1 className="text-2xl font-bold text-center" style={{ color: "#6B8C8E" }}>
                        Register
                    </h1>
                    {error && <div className="text-red-600 text-sm">{error}</div>}
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Username</span>
                        </label>
                        <input
                            type="text"
                            className="input input-bordered w-full"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
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
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Password</span>
                        </label>
                        <input
                            type="password"
                            className="input input-bordered w-full"
                            value={password}
                            onChange={(e) => {
                                const value = e.target.value;
                                setPassword(value);
                                setPasswordErrors(validatePassword(value));
                            }}
                            required
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
                    <button
                        type="submit"
                        className="btn w-full text-white"
                        style={{ backgroundColor: "#6B8C8E" }}
                    >
                        Register
                    </button>
                </form>
            </main>
        </div>
    );
}
