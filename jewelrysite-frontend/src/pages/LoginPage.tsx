import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import Header from "../components/Header";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            await login({ email, password });
            const redirectTo = (location.state as { from?: string } | null)?.from || "/";
            navigate(redirectTo);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "Login failed";
            setError(message);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#f3f6f7] via-[#eef3f4] to-[#6B8C8E] bg-fixed flex flex-col">
            <Header />
            <main className="flex-grow flex items-center justify-center p-4">
                <form onSubmit={onSubmit} className="bg-white/90 rounded-lg shadow-md p-6 w-full max-w-md space-y-4">
                    <h1 className="text-2xl font-bold text-center" style={{ color: "#6B8C8E" }}>
                        Login
                    </h1>
                    {error && <div className="text-red-600 text-sm">{error}</div>}
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
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <Link
                        to="/forgot-password"
                        className="btn btn-outline btn-sm w-full border-[#6B8C8E] text-[#6B8C8E] hover:bg-[#6B8C8E] hover:text-white"
                    >
                        Forgot your password?
                    </Link>
                    <button
                        type="submit"
                        className="btn w-full text-white"
                        style={{ backgroundColor: "#6B8C8E" }}
                    >
                        Login
                    </button>
                    <p className="text-sm text-center">
                        Don't have an account?{' '}
                        <Link to="/register" className="underline">
                            Register
                        </Link>
                    </p>
                </form>
            </main>
        </div>
    );
}

