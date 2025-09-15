import { Link, useLocation } from "react-router-dom";

export default function Header() {
    const location = useLocation();
    const BRAND = "#6B8C8E";     // same as your page titles
    const HEADER_BG = "#E3F0F2";

    const links = [
        { to: "/", label: "Home" },
        { to: "/catalog", label: "Catalog" },
        { to: "#", label: "Contact" }, // placeholder for now
    ];
    const filteredLinks = links.filter(l => l.to !== location.pathname);

    return (
        <header
            className="sticky top-0 inset-x-0 z-50 w-full shadow-sm"
            style={{ backgroundColor: HEADER_BG }}
        >
            <div className="flex items-center gap-6 py-2 px-4">
                {/* Brand */}
                <Link
                    to="/"
                    className="text-2xl font-extrabold tracking-wide"
                    style={{
                        color: BRAND,
                        textShadow: "0 1px 0 rgba(0,0,0,0.05)",
                    }}
                >
                    EDTArt
                </Link>

                {/* Nav links */}
                <nav className="flex items-center gap-6 ml-4">
                    {filteredLinks.map(link => (
                        <Link
                            key={link.to}
                            to={link.to}
                            className="text-base sm:text-lg font-semibold relative group transition"
                            style={{ color: BRAND }}
                        >
                            {link.label}
                            {/* underline animation on hover */}
                            <span className="absolute left-0 -bottom-0.5 w-0 h-0.5 bg-current transition-all duration-200 group-hover:w-full"></span>
                        </Link>
                    ))}
                </nav>

                {/* Cart icon at far right */}
                <Link
                    to="/cart"
                    aria-label="Cart"
                    className="ml-auto inline-flex items-center justify-center w-9 h-9 rounded-lg hover:bg-[rgba(0,0,0,0.06)]"
                    title="Cart"
                >
                    <svg
                        width="22" height="22" viewBox="0 0 24 24" fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M6 6h15l-1.5 8.5a2 2 0 0 1-2 1.5H9a2 2 0 0 1-2-1.5L5 3H2"
                            stroke={BRAND}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <circle cx="9" cy="20" r="1.5" fill={BRAND} />
                        <circle cx="17" cy="20" r="1.5" fill={BRAND} />
                    </svg>
                </Link>
            </div>
        </header>
    );
}
