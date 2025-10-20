export type JwtPayload = {
    [key: string]: unknown;
};

export function decodeJwtPayload<T extends JwtPayload = JwtPayload>(token: string): T | null {
    try {
        const parts = token.split(".");
        if (parts.length < 2) {
            return null;
        }
        const base64Url = parts[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const paddedBase64 = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
        const jsonPayload = decodeURIComponent(
            atob(paddedBase64)
                .split("")
                .map(char => "%" + ("00" + char.charCodeAt(0).toString(16)).slice(-2))
                .join("")
        );
        return JSON.parse(jsonPayload) as T;
    } catch {
        return null;
    }
}
