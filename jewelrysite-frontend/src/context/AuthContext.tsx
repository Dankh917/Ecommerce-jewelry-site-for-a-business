/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { login as loginRequest, refreshToken as refreshTokenRequest } from "../api/auth";
import { onAuthTokenRefreshed, setAuthTokens } from "../api/http";

interface User {
    id?: number;
    userId?: number;
    sub?: string | number;
    [key: string]: unknown;
}

interface AuthContextType {
    jwtToken: string | null;
    refreshToken: string | null;
    user: User | null;
    login: (data: { email: string; password: string }) => Promise<void>;
    logout: () => void;
    refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [jwtToken, setJwtToken] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const storedJwt = localStorage.getItem("jwtToken");
        const storedRefresh = localStorage.getItem("refreshToken");
        let parsedUser: User | null = null;
        let uid: number | undefined;
        if (storedJwt) {
            setJwtToken(storedJwt);
            parsedUser = parseJwt(storedJwt);
            setUser(parsedUser);
            const id = parsedUser?.userId ?? parsedUser?.id ?? parsedUser?.sub;
            if (id !== undefined) {
                uid = Number(id);
            }
        }
        if (storedRefresh) {
            setRefreshToken(storedRefresh);
        }
        setAuthTokens(storedJwt, storedRefresh, uid);
    }, []);

    useEffect(() => {
        onAuthTokenRefreshed((jwt, refresh) => {
            setJwtToken(jwt);
            setRefreshToken(refresh);
            setUser(parseJwt(jwt));
        });
    }, []);

    const login = async (data: { email: string; password: string }) => {
        const res = await loginRequest(data);
        const parsed = parseJwt(res.jwtToken);
        setJwtToken(res.jwtToken);
        setRefreshToken(res.refreshToken);
        setUser(parsed);
        const uid = parsed?.userId ?? parsed?.id ?? parsed?.sub;
        setAuthTokens(res.jwtToken, res.refreshToken, uid ? Number(uid) : undefined);
        localStorage.setItem("jwtToken", res.jwtToken);
        localStorage.setItem("refreshToken", res.refreshToken);
    };

    const logout = () => {
        setJwtToken(null);
        setRefreshToken(null);
        setUser(null);
        setAuthTokens(null, null, null);
        localStorage.removeItem("jwtToken");
        localStorage.removeItem("refreshToken");
    };

    const refresh = async () => {
        if (!refreshToken || !user) return;
        const userId = user.userId ?? user.id ?? user.sub;
        if (userId === undefined) return;
        const res = await refreshTokenRequest({
            userId: Number(userId),
            refreshToken,
        });
        setJwtToken(res.jwtToken);
        setRefreshToken(res.refreshToken);
        setUser(parseJwt(res.jwtToken));
        setAuthTokens(res.jwtToken, res.refreshToken, Number(userId));
        localStorage.setItem("jwtToken", res.jwtToken);
        localStorage.setItem("refreshToken", res.refreshToken);
    };

    return (
        <AuthContext.Provider value={{ jwtToken, refreshToken, user, login, logout, refresh }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return ctx;
}

function parseJwt(token: string): User | null {
    try {
        const base64Url = token.split(".")[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split("")
                .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                .join("")
        );
        return JSON.parse(jsonPayload);
    } catch {
        return null;
    }
}

