export function validatePassword(password: string): string[] {
    const errors: string[] = [];

    if (!password || password.trim().length === 0) {
        errors.push("Password is required.");
        return errors;
    }

    if (password.length < 8) {
        errors.push("Password must be at least 8 characters long.");
    }

    if (!/\d/.test(password)) {
        errors.push("Password must include at least one digit.");
    }

    return errors;
}

export function isPasswordValid(password: string): boolean {
    return validatePassword(password).length === 0;
}
