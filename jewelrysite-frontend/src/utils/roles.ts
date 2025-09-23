export function extractRoles(claims: Record<string, unknown> | null | undefined): string[] {
    if (!claims) {
        return [];
    }

    const roleSet = new Set<string>();

    const isRoleKey = (key: string) => {
        const normalized = key.toLowerCase();
        if (normalized === "role" || normalized === "roles") {
            return true;
        }
        const suffixes = ["/role", ":role", "_role", "/roles", ":roles", "_roles"];
        return suffixes.some(suffix => normalized.endsWith(suffix));
    };

    const addValue = (value: unknown) => {
        if (typeof value === "string") {
            value
                .split(/[,;]/)
                .map(segment => segment.trim())
                .filter(Boolean)
                .forEach(segment => roleSet.add(segment));
            return;
        }
        if (Array.isArray(value)) {
            value.forEach(entry => {
                if (typeof entry === "string" && entry.trim().length > 0) {
                    roleSet.add(entry.trim());
                }
            });
        }
    };

    Object.entries(claims).forEach(([key, value]) => {
        if (!isRoleKey(key)) {
            return;
        }
        addValue(value);
    });

    return Array.from(roleSet);
}

export function isAdmin(claims: Record<string, unknown> | null | undefined): boolean {
    return extractRoles(claims).some(role => role.toLowerCase() === "admin");
}
