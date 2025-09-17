/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { login as loginRequest, refreshToken as refreshTokenRequest } from "../api/auth";
import { onAuthTokenRefreshed, setAuthTokens } from "../api/http";
import { decodeJwtPayload } from "../utils/jwt";
import { resolveUserId } from "../utils/user";

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

        if (storedJwt) {
            setJwtToken(storedJwt);
            parsedUser = decodeJwtPayload<User>(storedJwt);
            setUser(parsedUser);
        }
        if (storedRefresh) {
            setRefreshToken(storedRefresh);
        }

        const resolvedId = resolveUserId(parsedUser, storedJwt);
        setAuthTokens(storedJwt, storedRefresh, resolvedId);
    }, []);

    useEffect(() => {
        onAuthTokenRefreshed((jwt, refresh) => {
            setJwtToken(jwt);
            setRefreshToken(refresh);
            setUser(decodeJwtPayload<User>(jwt));
        });
    }, []);

    const login = async (data: { email: string; password: string }) => {
        const res = await loginRequest(data);
        const parsed = decodeJwtPayload<User>(res.jwtToken);
        setJwtToken(res.jwtToken);
        setRefreshToken(res.refreshToken);
        setUser(parsed);
        const uid = resolveUserId(parsed, res.jwtToken);
        setAuthTokens(res.jwtToken, res.refreshToken, uid);
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
        const existingId = resolveUserId(user, jwtToken);
        if (existingId === null) return;
        const res = await refreshTokenRequest({
            userId: existingId,
            refreshToken,
        });
        const refreshedUser = decodeJwtPayload<User>(res.jwtToken);
        setJwtToken(res.jwtToken);
        setRefreshToken(res.refreshToken);
        setUser(refreshedUser);
        const updatedId = resolveUserId(refreshedUser, res.jwtToken) ?? existingId;
        setAuthTokens(res.jwtToken, res.refreshToken, updatedId);
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

