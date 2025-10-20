import { http } from "./http";

type AuthResponse = { jwtToken: string; refreshToken: string };

export async function register(
    data: { username: string; password: string; email: string }
): Promise<AuthResponse> {
    const res = await http.post<AuthResponse>("/api/Auth/register", data);
    return res.data;
}

export async function login(
    data: { email: string; password: string }
): Promise<AuthResponse> {
    const res = await http.post<AuthResponse>("/api/Auth/login", data);
    return res.data;
}

export async function refreshToken(
    data: { userId: number; refreshToken: string }
): Promise<AuthResponse> {
    const res = await http.post<AuthResponse>("/api/Auth/refresh-token", data);
    return res.data;
}

export async function forgotPassword(email: string): Promise<string> {
    const res = await http.post<{ message: string }>(
        "/api/Auth/forgot-password",
        JSON.stringify(email.trim()),
        {
            headers: { "Content-Type": "application/json" },
        }
    );
    return res.data.message;
}

export async function resetPassword(data: {
    token: string;
    newPassword: string;
}): Promise<string> {
    const params = new URLSearchParams({
        token: data.token,
        newPassword: data.newPassword,
    });

    const res = await http.post<{ message: string }>(
        `/api/Auth/reset-password?${params.toString()}`
    );
    return res.data.message;
}
