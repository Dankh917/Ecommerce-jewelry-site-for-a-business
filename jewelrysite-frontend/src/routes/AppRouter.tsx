import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import HomePage from "../pages/HomePage";
import CatalogPage from "../pages/CatalogPage";
import JewelryItemPage from "../pages/JewelryItemPage";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import { useAuth } from "../context/AuthContext";

function RequireAuth({ children }: { children: JSX.Element }) {
    const { jwtToken } = useAuth();
    const location = useLocation();

    const storedToken = typeof window !== "undefined" ? localStorage.getItem("jwtToken") : null;
    const token = jwtToken ?? storedToken;

    if (!token) {
        const from = `${location.pathname}${location.search}${location.hash}`;
        return <Navigate to="/login" state={{ from }} replace />;
    }

    return children;
}

export default function AppRouter() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route
                    path="/catalog"
                    element={
                        <RequireAuth>
                            <CatalogPage />
                        </RequireAuth>
                    }
                />
                <Route
                    path="/item/:id"
                    element={
                        <RequireAuth>
                            <JewelryItemPage />
                        </RequireAuth>
                    }
                />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
            </Routes>
        </BrowserRouter>
    );
}
