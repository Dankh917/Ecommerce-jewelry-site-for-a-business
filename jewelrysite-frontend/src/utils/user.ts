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

function extractFromClaims(claims: UserLike): number | null {
    if (!claims) {
        return null;
    }
    const record = claims as Record<string, unknown>;
    const possibleKeys = ["userId", "id", "sub"] as const;
    for (const key of possibleKeys) {
        const value = record[key];
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
