import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import Header from "../components/Header";
import { useAuth } from "../context/AuthContext";
import { getCart, removeItemFromCart } from "../api/cart";
import type { CartItemSummary, CartResponse } from "../types/Cart";
import { resolveUserId } from "../utils/user";

export default function CartPage() {
    const { user, jwtToken } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const userId = useMemo(() => resolveUserId(user, jwtToken), [user, jwtToken]);

    const [cart, setCart] = useState<CartResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [removingId, setRemovingId] = useState<number | null>(null);
    const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showBanner = useCallback((type: "success" | "error", message: string, duration = 2500) => {
        setBanner({ type, message });
        if (bannerTimeoutRef.current) {
            clearTimeout(bannerTimeoutRef.current);
        }
        if (duration > 0) {
            bannerTimeoutRef.current = setTimeout(() => setBanner(null), duration);
        }
    }, []);

    useEffect(() => {
        return () => {
            if (bannerTimeoutRef.current) {
                clearTimeout(bannerTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        const storedToken = typeof window !== "undefined" ? localStorage.getItem("jwtToken") : null;
        if (!userId) {
            if (!storedToken) {
                navigate("/login", { replace: true, state: { from: location.pathname } });
                setLoading(false);
            }
            return;
        }

        let active = true;
        setLoading(true);
        setError(null);

        (async () => {
            try {
                const data = await getCart(userId);
                if (!active) return;
                setCart(data);
            } catch (err: unknown) {
                if (!active) return;
                const message = isAxiosError(err)
                    ? err.response?.data?.message ?? err.response?.data ?? err.message
                    : err instanceof Error
                      ? err.message
                      : "Unable to load cart.";
                setError(typeof message === "string" ? message : "Unable to load cart.");
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            active = false;
        };
    }, [userId, navigate, location.pathname]);

    const handleRemove = useCallback(
        async (item: CartItemSummary) => {
            if (!userId) return;
            setRemovingId(item.jewelryItemId);
            try {
                await removeItemFromCart(userId, item.jewelryItemId);
                setCart(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        items: prev.items.filter(ci => ci.jewelryItemId !== item.jewelryItemId),
                    };
                });
                showBanner("success", "Item removed from cart.");
            } catch (err: unknown) {
                const message = isAxiosError(err)
                    ? err.response?.data?.message ?? err.response?.data ?? err.message
                    : err instanceof Error
                      ? err.message
                      : "Unable to remove item.";
                showBanner("error", typeof message === "string" ? message : "Unable to remove item.", 4000);
            } finally {
                setRemovingId(null);
            }
        },
        [userId, showBanner]
    );

    const items = useMemo(() => cart?.items ?? [], [cart]);

    const { subtotal, shipping, total } = useMemo(() => {
        const subtotalValue = items.reduce((acc, item) => acc + item.priceAtAddTime * item.quantity, 0);
        const shippingValue = items.reduce((acc, item) => {
            const shippingPrice = item.jewelryItem?.shippingPrice ?? 0;
            return acc + shippingPrice * item.quantity;
        }, 0);
        return {
            subtotal: subtotalValue,
            shipping: shippingValue,
            total: subtotalValue + shippingValue,
        };
    }, [items]);

    const formatCurrency = useCallback((value: number) => {
        return value.toLocaleString(undefined, {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
        });
    }, []);

    return (
        <div className="min-h-screen bg-[#fbfbfa] flex flex-col">
            <Header />
            <main className="flex-1 w-full">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                    <div className="flex items-baseline justify-between mb-6">
                        <div>
                            <h1 className="text-3xl font-extrabold tracking-wide" style={{ color: "#6B8C8E" }}>
                                Your Cart
                            </h1>
                            <p className="text-sm text-gray-600 mt-1">Review your selected pieces and continue to checkout.</p>
                        </div>
                        <Link
                            to="/catalog"
                            className="text-sm font-semibold underline"
                            style={{ color: "#6B8C8E" }}
                        >
                            Continue shopping
                        </Link>
                    </div>

                    {loading ? (
                        <div className="bg-white shadow rounded-lg p-10 text-center text-gray-500">Loading your cart…</div>
                    ) : error ? (
                        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-6">
                            {error}
                        </div>
                    ) : items.length === 0 ? (
                        <div
                            className="bg-white shadow rounded-lg p-10 text-center"
                            role="status"
                            aria-live="polite"
                        >
                            <p className="text-lg font-semibold text-gray-700">Your cart is currently empty.</p>
                            <p className="text-sm text-gray-500 mt-2">
                                Items you add will appear here. Browse our catalog to discover handcrafted jewelry that fits your
                                style.
                            </p>
                            <Link
                                to="/catalog"
                                className="inline-flex items-center justify-center mt-6 px-5 py-2.5 rounded-lg text-white font-semibold shadow"
                                style={{ backgroundColor: "#6B8C8E" }}
                            >
                                Explore the collection
                            </Link>
                        </div>
                    ) : (
                        <div className="grid gap-8 lg:grid-cols-[minmax(0,_2fr)_minmax(0,_1fr)]">
                            <ul className="space-y-5">
                                {items.map(item => {
                                    const jewelry = item.jewelryItem;
                                    const itemTotal = item.priceAtAddTime * item.quantity;
                                    const shippingCost = (jewelry?.shippingPrice ?? 0) * item.quantity;
                                    return (
                                        <li
                                            key={item.id}
                                            className="bg-white shadow rounded-xl overflow-hidden border border-gray-100"
                                        >
                                            <div className="flex flex-col sm:flex-row">
                                                <div className="sm:w-44 sm:h-44 w-full h-56 bg-white flex items-center justify-center overflow-hidden">
                                                    {jewelry?.mainImageUrl ? (
                                                        <img
                                                            src={jewelry.mainImageUrl}
                                                            alt={jewelry.name}
                                                            className="max-h-full max-w-full object-contain p-3"
                                                        />
                                                    ) : (
                                                        <span className="text-sm text-gray-400">No image</span>
                                                    )}
                                                </div>
                                                <div className="flex-1 p-5 sm:p-6 flex flex-col gap-4">
                                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                                        <div>
                                                            <h2 className="text-lg font-semibold text-gray-900">{jewelry?.name ?? `Item #${item.jewelryItemId}`}</h2>
                                                            {jewelry?.description && (
                                                                <p className="text-sm text-gray-600 mt-1 line-clamp-3">
                                                                    {jewelry.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-base font-semibold text-gray-900">
                                                                {formatCurrency(item.priceAtAddTime)}
                                                            </p>
                                                            <p className="text-xs text-gray-500">Price per item</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                                        <div className="inline-flex items-center gap-3 text-sm text-gray-600">
                                                            <span className="font-semibold text-gray-700">Quantity:</span>
                                                            <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-800 font-medium">
                                                                {item.quantity}
                                                            </span>
                                                            {shippingCost > 0 && (
                                                                <span className="text-xs text-gray-500">
                                                                    Shipping: {formatCurrency(shippingCost)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <div className="text-right">
                                                                <p className="text-sm text-gray-500">Subtotal</p>
                                                                <p className="text-lg font-semibold text-gray-900">
                                                                    {formatCurrency(itemTotal + shippingCost)}
                                                                </p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemove(item)}
                                                                disabled={removingId === item.jewelryItemId}
                                                                className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 hover:border-red-400 hover:text-red-600 transition disabled:opacity-50"
                                                            >
                                                                {removingId === item.jewelryItemId ? "Removing…" : "Remove"}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                            <aside className="bg-white shadow rounded-xl border border-gray-100 p-6 h-fit space-y-4">
                                <h2 className="text-xl font-semibold text-gray-900">Order summary</h2>
                                <div className="flex items-center justify-between text-sm text-gray-700">
                                    <span>Items subtotal</span>
                                    <span>{formatCurrency(subtotal)}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm text-gray-700">
                                    <span>Estimated shipping</span>
                                    <span>{shipping > 0 ? formatCurrency(shipping) : "Free"}</span>
                                </div>
                                <hr className="border-gray-200" />
                                <div className="flex items-center justify-between text-lg font-semibold text-gray-900">
                                    <span>Total</span>
                                    <span>{formatCurrency(total)}</span>
                                </div>
                                <button
                                    type="button"
                                    className="w-full mt-4 inline-flex items-center justify-center px-5 py-3 rounded-lg text-white font-semibold shadow-lg"
                                    style={{ backgroundColor: "#6B8C8E" }}
                                >
                                    Proceed to checkout
                                </button>
                                <p className="text-xs text-gray-500">
                                    Taxes and discounts calculated at checkout. Secure payments powered by our trusted partners.
                                </p>
                            </aside>
                        </div>
                    )}
                </div>
            </main>
            {banner && (
                <div
                    className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg text-sm font-semibold text-white ${
                        banner.type === "success" ? "bg-emerald-600" : "bg-red-600"
                    }`}
                >
                    {banner.message}
                </div>
            )}
        </div>
    );
}
