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