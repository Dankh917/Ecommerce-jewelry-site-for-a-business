import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { isAxiosError } from "axios";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { useAuth } from "../context/AuthContext";
import { resolveUserId } from "../utils/user";
import { getCart } from "../api/cart";
import { createOrder, getPayPalAccessToken } from "../api/orders";
import { getPayPalClientConfig } from "../api/config";
import {
    PayPalButtons,
    PayPalScriptProvider,
    type ReactPayPalScriptOptions,
} from "@paypal/react-paypal-js";
import type { CartItemSummary, CartResponse } from "../types/Cart";
import type { OrderConfirmationResponse } from "../types/Order";

interface CheckoutFormData {
    fullName: string;
    phoneNumber: string;
    country: string;
    city: string;
    street: string;
    postalCode: string;
    notes: string;
}

interface OrderConfirmation {
    order: OrderConfirmationResponse;
    shipping: CheckoutFormData;
    items: CartItemSummary[];
    totals: {
        subtotal: number;
        shipping: number;
        total: number;
    };
}

const initialFormState: CheckoutFormData = {
    fullName: "",
    phoneNumber: "",
    country: "",
    city: "",
    street: "",
    postalCode: "",
    notes: "",
};

export default function CheckoutPage() {
    const { user, jwtToken } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const userId = useMemo(() => resolveUserId(user, jwtToken), [user, jwtToken]);

    const [cart, setCart] = useState<CartResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState<CheckoutFormData>(initialFormState);
    const [submitting, setSubmitting] = useState(false);
    const [orderConfirmation, setOrderConfirmation] = useState<OrderConfirmation | null>(null);
    const [paypalClientId, setPaypalClientId] = useState<string | null>(null);
    const [paypalBaseUrl, setPaypalBaseUrl] = useState<string | null>(null);
    const [paypalError, setPaypalError] = useState<string | null>(null);
    const [paypalLoading, setPaypalLoading] = useState(true);

    const calculateTotals = useCallback((items: CartItemSummary[]) => {
        const subtotalValue = items.reduce((acc, item) => acc + item.priceAtAddTime * item.quantity, 0);
        const shippingValue = items.reduce((max, item) => {
            const shippingPrice = item.jewelryItem?.shippingPrice ?? 0;
            return Math.max(max, shippingPrice);
        }, 0);
        return {
            subtotal: subtotalValue,
            shipping: shippingValue,
            total: subtotalValue + shippingValue,
        };
    }, []);

    const totals = useMemo(() => calculateTotals(cart?.items ?? []), [cart, calculateTotals]);

    const paypalOptions = useMemo<ReactPayPalScriptOptions | null>(() => {
        if (!paypalClientId) {
            return null;
        }
        return {
            clientId: paypalClientId,
            components: "buttons",
        } satisfies ReactPayPalScriptOptions;
    }, [paypalClientId]);

    const formatCurrency = useCallback((value: number) => {
        return value.toLocaleString(undefined, {
            style: "currency",
            currency: "USD",
            currencyDisplay: "code",
            minimumFractionDigits: 2,
        });
    }, []);

    const cartItemsWithShipping = useMemo(() => {
        const cartItems = cart?.items ?? [];
        let shippingChargeAssigned = false;
        return cartItems.map(item => {
            const shippingPrice = item.jewelryItem?.shippingPrice ?? 0;
            const applyShipping =
                !shippingChargeAssigned && totals.shipping > 0 && shippingPrice === totals.shipping;
            if (applyShipping) {
                shippingChargeAssigned = true;
            }
            return {
                item,
                shippingCost: applyShipping ? totals.shipping : 0,
            };
        });
    }, [cart, totals.shipping]);

    const confirmationItemsWithShipping = useMemo(() => {
        if (!orderConfirmation) {
            return [] as Array<{ item: CartItemSummary; shippingCost: number }>;
        }
        let shippingChargeAssigned = false;
        return orderConfirmation.items.map(item => {
            const shippingPrice = item.jewelryItem?.shippingPrice ?? 0;
            const applyShipping =
                !shippingChargeAssigned && orderConfirmation.totals.shipping > 0 &&
                shippingPrice === orderConfirmation.totals.shipping;
            if (applyShipping) {
                shippingChargeAssigned = true;
            }
            return {
                item,
                shippingCost: applyShipping ? orderConfirmation.totals.shipping : 0,
            };
        });
    }, [orderConfirmation]);

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
                      : "Unable to load checkout information.";
                setError(typeof message === "string" ? message : "Unable to load checkout information.");
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

    useEffect(() => {
        let active = true;
        setPaypalLoading(true);
        setPaypalError(null);

        getPayPalClientConfig()
            .then((config) => {
                if (!active) return;
                setPaypalClientId(config.clientId);
                setPaypalBaseUrl(config.baseUrl);
                setPaypalError(null);
            })
            .catch(() => {
                if (!active) return;
                setPaypalBaseUrl(null);
                setPaypalError("PayPal checkout is currently unavailable.");
            })
            .finally(() => {
                if (!active) return;
                setPaypalLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = event.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!userId || !cart) {
            return;
        }
        if (cart.items.length === 0) {
            setError("Your cart is empty. Please add items before checking out.");
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const payload = {
                userId,
                cartId: cart.id,
                fullName: formData.fullName.trim(),
                phoneNumber: formData.phoneNumber.trim(),
                country: formData.country.trim(),
                city: formData.city.trim(),
                street: formData.street.trim(),
                postalCode: formData.postalCode.trim(),
                notes: formData.notes.trim() || undefined,
            };

            const existingItems = cart.items.map((item) => ({ ...item }));
            const order = await createOrder(payload);

            setOrderConfirmation({
                order,
                shipping: formData,
                items: existingItems,
                totals: calculateTotals(existingItems),
            });
            setFormData(initialFormState);

            try {
                const refreshedCart = await getCart(userId);
                setCart(refreshedCart);
            } catch (refreshError) {
                console.error("Failed to refresh cart after checkout", refreshError);
            }
        } catch (err: unknown) {
            const message = isAxiosError(err)
                ? err.response?.data?.message ?? err.response?.data ?? err.message
                : err instanceof Error
                  ? err.message
                  : "Unable to complete order.";
            setError(typeof message === "string" ? message : "Unable to complete order.");
        } finally {
            setSubmitting(false);
        }
    };

    const hasItems = (cart?.items.length ?? 0) > 0;

    return (
        <div className="min-h-screen bg-[#fbfbfa] flex flex-col">
            <Header />
            <main className="flex-1 w-full">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-3xl font-extrabold tracking-wide" style={{ color: "#6B8C8E" }}>
                            Checkout
                        </h1>
                        {!orderConfirmation && (
                            <p className="text-sm text-gray-600">
                                Provide your contact and delivery details to finalize your order.
                            </p>
                        )}
                    </div>

                    {loading ? (
                        <div className="bg-white shadow rounded-lg p-10 text-center text-gray-500">
                            Preparing your checkout details…
                        </div>
                    ) : error ? (
                        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-6">{error}</div>
                    ) : orderConfirmation ? (
                        <div className="bg-white shadow rounded-xl border border-gray-100 p-8 space-y-6">
                            <div className="space-y-2">
                                <h2 className="text-2xl font-semibold text-gray-900">Thank you for your order!</h2>
                                <p className="text-sm text-gray-600">
                                    We’ve received your order and sent a confirmation to your email.
                                </p>
                                {orderConfirmation.order.orderId && (
                                    <p className="text-sm text-gray-700">
                                        Order reference: <strong>#{orderConfirmation.order.orderId}</strong>
                                    </p>
                                )}
                            </div>

                            <div className="grid gap-6 lg:grid-cols-2">
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-gray-900">Shipping details</h3>
                                    <ul className="text-sm text-gray-700 space-y-1">
                                        <li>
                                            <strong>Name:</strong> {orderConfirmation.shipping.fullName || "—"}
                                        </li>
                                        <li>
                                            <strong>Phone:</strong> {orderConfirmation.shipping.phoneNumber || "—"}
                                        </li>
                                        <li>
                                            <strong>Address:</strong> {orderConfirmation.shipping.street}, {orderConfirmation.shipping.city}, {orderConfirmation.shipping.country}
                                        </li>
                                        <li>
                                            <strong>Postal code:</strong> {orderConfirmation.shipping.postalCode || "—"}
                                        </li>
                                        {orderConfirmation.shipping.notes && (
                                            <li>
                                                <strong>Notes:</strong> {orderConfirmation.shipping.notes}
                                            </li>
                                        )}
                                    </ul>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-gray-900">Order summary</h3>
                                    <ul className="space-y-3 text-sm text-gray-700">
                                        {confirmationItemsWithShipping.map(({ item, shippingCost }) => {
                                            const jewelry = item.jewelryItem;
                                            const lineTotal = item.priceAtAddTime * item.quantity;
                                            return (
                                                <li key={`confirmation-${item.id}`} className="flex justify-between">
                                                    <div>
                                                        <p className="font-medium">{jewelry?.name ?? `Item #${item.jewelryItemId}`}</p>
                                                        <p className="text-xs text-gray-500">Qty {item.quantity}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p>{formatCurrency(lineTotal)}</p>
                                                        {shippingCost > 0 && (
                                                            <p className="text-xs text-gray-500">Shipping {formatCurrency(shippingCost)}</p>
                                                        )}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                    <div className="space-y-1 text-sm text-gray-700">
                                        <div className="flex justify-between">
                                            <span>Items subtotal</span>
                                            <span>{formatCurrency(orderConfirmation.totals.subtotal)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Shipping</span>
                                            <span>
                                                {orderConfirmation.totals.shipping > 0
                                                    ? formatCurrency(orderConfirmation.totals.shipping)
                                                    : "Free"}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-lg font-semibold text-gray-900 pt-2 border-t border-gray-200">
                                            <span>Total</span>
                                            <span>{formatCurrency(orderConfirmation.totals.total)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    onClick={() => navigate("/catalog")}
                                    className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-white font-semibold shadow"
                                    style={{ backgroundColor: "#6B8C8E" }}
                                >
                                    Continue shopping
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate("/cart")}
                                    className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-[#6B8C8E] font-semibold border border-[#6B8C8E]"
                                >
                                    View cart
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-8 lg:grid-cols-[minmax(0,_3fr)_minmax(0,_2fr)]">
                            <form onSubmit={handleSubmit} className="bg-white shadow rounded-xl border border-gray-100 p-6 space-y-6">
                                <h2 className="text-xl font-semibold text-gray-900">Shipping information</h2>
                                <div className="grid gap-5 sm:grid-cols-2">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-medium text-gray-700" htmlFor="fullName">
                                            Full name
                                        </label>
                                        <input
                                            id="fullName"
                                            name="fullName"
                                            type="text"
                                            value={formData.fullName}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6B8C8E]"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-medium text-gray-700" htmlFor="phoneNumber">
                                            Phone number
                                        </label>
                                        <input
                                            id="phoneNumber"
                                            name="phoneNumber"
                                            type="tel"
                                            value={formData.phoneNumber}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6B8C8E]"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-medium text-gray-700" htmlFor="country">
                                            Country
                                        </label>
                                        <input
                                            id="country"
                                            name="country"
                                            type="text"
                                            value={formData.country}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6B8C8E]"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-medium text-gray-700" htmlFor="city">
                                            City
                                        </label>
                                        <input
                                            id="city"
                                            name="city"
                                            type="text"
                                            value={formData.city}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6B8C8E]"
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-5 sm:grid-cols-[minmax(0,_3fr)_minmax(0,_2fr)]">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-medium text-gray-700" htmlFor="street">
                                            Street address
                                        </label>
                                        <input
                                            id="street"
                                            name="street"
                                            type="text"
                                            value={formData.street}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6B8C8E]"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-medium text-gray-700" htmlFor="postalCode">
                                            Postal code
                                        </label>
                                        <input
                                            id="postalCode"
                                            name="postalCode"
                                            type="text"
                                            value={formData.postalCode}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6B8C8E]"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-gray-700" htmlFor="notes">
                                        Notes for the jeweler (optional)
                                    </label>
                                    <textarea
                                        id="notes"
                                        name="notes"
                                        value={formData.notes}
                                        onChange={handleInputChange}
                                        rows={4}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6B8C8E]"
                                        placeholder="Share any specific instructions or preferences for delivery."
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={submitting || !hasItems}
                                    className="inline-flex items-center justify-center px-5 py-3 rounded-lg text-white font-semibold shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                                    style={{ backgroundColor: "#6B8C8E" }}
                                >
                                    {submitting ? "Placing your order…" : "Place order"}
                                </button>
                                {!hasItems && (
                                    <p className="text-xs text-red-600">
                                        Your cart is empty. Please return to the <Link to="/catalog" className="underline">catalog</Link> to add items.
                                    </p>
                                )}
                            </form>

                            <aside className="bg-white shadow rounded-xl border border-gray-100 p-6 h-fit space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-semibold text-gray-900">Order summary</h2>
                                    <Link to="/cart" className="text-sm font-semibold underline" style={{ color: "#6B8C8E" }}>
                                        Edit cart
                                    </Link>
                                </div>
                                <ul className="space-y-3">
                                    {cartItemsWithShipping.map(({ item, shippingCost }) => {
                                        const jewelry = item.jewelryItem;
                                        const lineTotal = item.priceAtAddTime * item.quantity;
                                        return (
                                            <li key={item.id} className="flex justify-between text-sm text-gray-700">
                                                <div className="pr-4">
                                                    <p className="font-medium">{jewelry?.name ?? `Item #${item.jewelryItemId}`}</p>
                                                    <p className="text-xs text-gray-500">Qty {item.quantity}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p>{formatCurrency(lineTotal)}</p>
                                                    {shippingCost > 0 && (
                                                        <p className="text-xs text-gray-500">Shipping {formatCurrency(shippingCost)}</p>
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                                <div className="flex items-center justify-between text-sm text-gray-700">
                                    <span>Items subtotal</span>
                                    <span>{formatCurrency(totals.subtotal)}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm text-gray-700">
                                    <span>Estimated shipping</span>
                                    <span>{totals.shipping > 0 ? formatCurrency(totals.shipping) : "Free"}</span>
                                </div>
                                <hr className="border-gray-200" />
                                <div className="flex items-center justify-between text-lg font-semibold text-gray-900">
                                    <span>Total</span>
                                    <span>{formatCurrency(totals.total)}</span>
                                </div>
                                <p className="text-xs text-gray-500">
                                    Secure payments are processed after you confirm your order.
                                </p>
                                <div className="pt-4 border-t border-gray-200 space-y-3">
                                    <h3 className="text-sm font-semibold text-gray-900">Pay with PayPal</h3>
                                    {paypalLoading ? (
                                        <p className="text-xs text-gray-500">Loading PayPal checkout…</p>
                                    ) : paypalError ? (
                                        <p className="text-xs text-red-600">{paypalError}</p>
                                    ) : !paypalOptions ? (
                                        <p className="text-xs text-gray-500">PayPal checkout is not configured.</p>
                                    ) : hasItems ? (
                                        <PayPalScriptProvider options={paypalOptions}>
                                            <PayPalButtons
                                                style={{ layout: "vertical", shape: "rect", color: "gold" }}
                                                createOrder={async () => {
                                                    if (!hasItems) {
                                                        const error = "Your cart is empty.";
                                                        setPaypalError(error);
                                                        throw new Error(error);
                                                    }

                                                    if (!paypalBaseUrl) {
                                                        const error = "PayPal checkout is not configured.";
                                                        setPaypalError(error);
                                                        throw new Error(error);
                                                    }

                                                    setPaypalError(null);

                                                    try {
                                                        const accessToken = await getPayPalAccessToken();
                                                        if (!accessToken) {
                                                            throw new Error("PayPal access token is unavailable.");
                                                        }

                                                        const normalizedBaseUrl = paypalBaseUrl.replace(/\/+$/, "");
                                                        const response = await fetch(`${normalizedBaseUrl}/v2/checkout/orders`, {
                                                            method: "POST",
                                                            headers: {
                                                                "Content-Type": "application/json",
                                                                Authorization: `Bearer ${accessToken}`,
                                                            },
                                                            body: JSON.stringify({
                                                                intent: "CAPTURE",
                                                                purchase_units: [
                                                                    {
                                                                        amount: {
                                                                            currency_code: "USD",
                                                                            value: totals.total.toFixed(2),
                                                                        },
                                                                    },
                                                                ],
                                                            }),
                                                        });

                                                        if (!response.ok) {
                                                            throw new Error("PayPal create order request failed.");
                                                        }

                                                        const order = await response.json();
                                                        if (!order?.id || typeof order.id !== "string") {
                                                            throw new Error("PayPal did not return an order id.");
                                                        }

                                                        return order.id;
                                                    } catch (err) {
                                                        console.error("Failed to create PayPal order", err);
                                                        setPaypalError("Unable to start PayPal checkout. Please try again.");
                                                        throw err instanceof Error
                                                            ? err
                                                            : new Error("Unable to start PayPal checkout.");
                                                    }
                                                }}
                                                onApprove={async (_data: unknown, actions: any) => {
                                                    try {
                                                        await actions?.order?.capture?.();
                                                    } catch (err) {
                                                        console.error("PayPal capture failed", err);
                                                    }
                                                }}
                                            />
                                        </PayPalScriptProvider>
                                    ) : (
                                        <p className="text-xs text-gray-500">Add items to your cart to enable PayPal checkout.</p>
                                    )}
                                </div>
                            </aside>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
