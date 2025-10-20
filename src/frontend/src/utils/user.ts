import { decodeJwtPayload } from "./jwt";

export type UserLike = Record<string, unknown> | null | undefined;

function parseUserId(candidate: unknown): number | null {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
        return candidate;
    }
    if (typeof candidate === "string" && candidate.trim().length > 0) {
        const parsed = Number(candidate);
        if (!Number.isNaN(parsed)) {
            return parsed;
        }
    }
    return null;
}

const POSSIBLE_ID_KEYS = new Set<string>([
    "userid",
    "id",
    "sub",
    "nameid",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
]);

function extractFromClaims(claims: UserLike): number | null {
    if (!claims) {
        return null;
    }
    const record = claims as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
        const normalizedKey = key.toLowerCase();
        if (!POSSIBLE_ID_KEYS.has(normalizedKey) && !POSSIBLE_ID_KEYS.has(key)) {
            continue;
        }
        const parsed = parseUserId(value);
        if (parsed !== null) {
            return parsed;
        }
    }
    return null;
}

export function resolveUserId(user: UserLike, jwtToken?: string | null): number | null {
    const fromUser = extractFromClaims(user);
    if (fromUser !== null) {
        return fromUser;
    }
    if (jwtToken) {
        const decoded = decodeJwtPayload<Record<string, unknown>>(jwtToken);
        return extractFromClaims(decoded ?? undefined);
    }
    return null;
}
