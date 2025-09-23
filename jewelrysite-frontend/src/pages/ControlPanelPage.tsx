import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { decodeJwtPayload } from "../utils/jwt";
import { extractRoles } from "../utils/roles";

type Claims = {
    [key: string]: unknown;
};

export default function ControlPanelPage() {
    const { user, jwtToken } = useAuth();

    const claims = useMemo<Claims | null>(() => {
        if (user) {
            return user as Claims;
        }
        if (jwtToken) {
            return decodeJwtPayload<Claims>(jwtToken);
        }
        return null;
    }, [jwtToken, user]);

    const roles = useMemo(() => extractRoles(claims), [claims]);
    const isAdmin = roles.some(role => role.toLowerCase() === "admin");

    if (!isAdmin) {
        return (
            <main className="p-6">
                <h1 className="text-2xl font-bold mb-4">Control Panel</h1>
                <p>You do not have permission to view this page.</p>
                <p className="mt-4">
                    <Link to="/" className="text-blue-600 underline">
                        Return to the home page
                    </Link>
                </p>
            </main>
        );
    }

    return (
        <main className="p-6">
            <h1 className="text-2xl font-bold mb-4">Control Panel</h1>
            <p>Admin-only controls will appear here.</p>
        </main>
    );
}
