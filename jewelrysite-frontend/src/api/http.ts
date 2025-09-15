import axios, { InternalAxiosRequestConfig } from "axios";
import { refreshToken as refreshTokenRequest } from "./auth";

interface RetryConfig extends InternalAxiosRequestConfig {
    _retry?: boolean;
}

type AuthState = {
    jwtToken: string | null;
    refreshToken: string | null;
    userId: number | null;
};

const authState: AuthState = {
    jwtToken: null,
    refreshToken: null,
    userId: null,
};

export function setAuthTokens(
    jwt: string | null,
    refresh: string | null,
    userId?: number | null
) {
    authState.jwtToken = jwt;
    authState.refreshToken = refresh;
    authState.userId = userId ?? authState.userId;
}

type TokenListener = (jwt: string, refresh: string) => void;
let tokenListener: TokenListener | null = null;

export function onAuthTokenRefreshed(listener: TokenListener) {
    tokenListener = listener;
}

export const http = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
    withCredentials: false,
});

http.interceptors.request.use((config) => {
    if (authState.jwtToken) {
        config.headers = config.headers ?? {};
        (config.headers as Record<string, string>).Authorization = `Bearer ${authState.jwtToken}`;
    }
    return config;
});

http.interceptors.response.use(
    (response) => response,
    async (error) => {
        const { response, config } = error;
        const originalConfig = config as RetryConfig;
        if (
            response?.status === 401 &&
            !originalConfig._retry &&
            originalConfig.url !== "/api/Auth/refresh-token" &&
            authState.refreshToken &&
            authState.userId !== null
        ) {
            originalConfig._retry = true;
            try {
                const res = await refreshTokenRequest({
                    userId: authState.userId,
                    refreshToken: authState.refreshToken,
                });
                setAuthTokens(res.jwtToken, res.refreshToken, authState.userId);
                tokenListener?.(res.jwtToken, res.refreshToken);
                localStorage.setItem("jwtToken", res.jwtToken);
                localStorage.setItem("refreshToken", res.refreshToken);
                return http(originalConfig);
            } catch (refreshError) {
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);