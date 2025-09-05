import { Link, useLocation } from "react-router-dom";

export default function Header() {
    const location = useLocation();
    const BRAND = "#3B82F6"; // brand blue
    const ACCENT = "#93C5FD"; // light blue accent

    const links = [
        { to: "/", label: "Home" },
        { to: "/catalog", label: "Catalog" }
    ];

    const filteredLinks = links.filter(link => link.to !== location.pathname);

    return (
        <header className="w-full flex flex-col items-center bg-blue-50 py-4">
            <h1
                className="text-3xl font-extrabold tracking-wide text-center bg-gradient-to-r from-[#3B82F6] to-[#93C5FD] text-transparent bg-clip-text"
                style={{ textShadow: "0 1px 0 rgba(0,0,0,0.05)" }}
            >
                EDTArt
            </h1>
            <div
                className="h-1.5 w-28 rounded-full mt-1"
                style={{ background: `linear-gradient(90deg, ${BRAND}, ${ACCENT})` }}
            />
            <nav className="mt-4 flex gap-4">
                {filteredLinks.map(link => (
                    <Link
                        key={link.to}
                        to={link.to}
                        className="text-lg font-medium hover:underline"
                        style={{ color: BRAND }}
                    >
                        {link.label}
                    </Link>
                ))}
            </nav>
        </header>
    );
}

