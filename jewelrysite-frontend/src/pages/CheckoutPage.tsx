import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { isAxiosError } from "axios";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { useAuth } from "../context/AuthContext";
import { resolveUserId } from "../utils/user";
import { getCart } from "../api/cart";
import { completeOrder, createOrder } from "../api/orders";
import type { CartItemSummary, CartResponse } from "../types/Cart";
import type { PayPalButtonsActions, PayPalButtonsApproveData } from "../types/paypal";

interface CheckoutFormData {
    fullName: string;
    phoneNumber: string;
    country: string;
    city: string;
    street: string;
    postalCode: string;
    notes: string;
}

interface CheckoutSession {
    shipping: CheckoutFormData;
    items: CartItemSummary[];
    totals: {
        subtotal: number;
        shipping: number;
        total: number;
    };
    cartId: number;
    payPalOrderId: string;
    payPalApprovalUrl: string | null;
    payPalStatus: string | null;
    currencyCode: string;
}

type PayPalSetupStatus = "idle" | "loading" | "ready" | "error";

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
    const [checkoutSession, setCheckoutSession] = useState<CheckoutSession | null>(null);
    const [payPalStatus, setPayPalStatus] = useState<PayPalSetupStatus>("idle");
    const [payPalError, setPayPalError] = useState<string | null>(null);
    const [payPalProcessing, setPayPalProcessing] = useState(false);

    const payPalContainerRef = useRef<HTMLDivElement | null>(null);
    const payPalButtonsRef = useRef<PayPalButtonsActions | null>(null);
    const sdkLoadersRef = useRef<Record<string, Promise<void>>>({});
    const isMountedRef = useRef(true);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
            if (payPalButtonsRef.current) {
                try {
                    payPalButtonsRef.current.close();
                } catch {
                    // Ignore cleanup errors.
                }
                payPalButtonsRef.current = null;
            }
        };
    }, []);

    const payPalClientId = (import.meta.env.VITE_PAYPAL_CLIENT_ID ?? "").trim();
    const payPalConfigured = payPalClientId.length > 0;

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

    const formatCurrency = useCallback((value: number, currencyCode?: string) => {
        const normalized = currencyCode && currencyCode.trim().length === 3 ? currencyCode.trim().toUpperCase() : "USD";
        return value.toLocaleString(undefined, {
            style: "currency",
            currency: normalized,
            currencyDisplay: "code",
            minimumFractionDigits: 2,
        });
    }, []);

    const attachShippingCost = useCallback((items: CartItemSummary[], shippingValue: number) => {
        let shippingAssigned = false;
        return items.map(item => {
            const shippingPrice = item.jewelryItem?.shippingPrice ?? 0;
            const includeShipping =
                !shippingAssigned && shippingValue > 0 && shippingPrice === shippingValue;
            if (includeShipping) {
                shippingAssigned = true;
            }
            return {
                item,
                shippingCost: includeShipping ? shippingValue : 0,
            };
        });
    }, []);

    const cartTotals = useMemo(() => calculateTotals(cart?.items ?? []), [cart, calculateTotals]);

    const cartItemsWithShipping = useMemo(() => {
        return attachShippingCost(cart?.items ?? [], cartTotals.shipping);
    }, [cart, cartTotals.shipping, attachShippingCost]);

    const checkoutItemsWithShipping = useMemo(() => {
        if (!checkoutSession) {
            return [] as Array<{ item: CartItemSummary; shippingCost: number }>;
        }
        return attachShippingCost(checkoutSession.items, checkoutSession.totals.shipping);
    }, [checkoutSession, attachShippingCost]);

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
                if (!active || !isMountedRef.current) return;
                setCart(data);
            } catch (err: unknown) {
                if (!active || !isMountedRef.current) return;
                const message = isAxiosError(err)
                    ? err.response?.data?.message ?? err.response?.data ?? err.message
                    : err instanceof Error
                      ? err.message
                      : "Unable to load checkout information.";
                setError(typeof message === "string" ? message : "Unable to load checkout information.");
            } finally {
                if (active && isMountedRef.current) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            active = false;
        };
    }, [userId, navigate, location.pathname]);

    useEffect(() => {
        if (checkoutSession) {
            return;
        }

        if (payPalButtonsRef.current) {
            try {
                payPalButtonsRef.current.close();
            } catch {
                // Ignore cleanup errors.
            }
            payPalButtonsRef.current = null;
        }
        if (payPalContainerRef.current) {
            payPalContainerRef.current.innerHTML = "";
        }
        setPayPalStatus("idle");
        setPayPalError(null);
        setPayPalProcessing(false);
    }, [checkoutSession]);

    const loadPayPalSdk = useCallback(
        (clientId: string, currencyCode: string) => {
            const normalizedClientId = clientId.trim();
            const normalizedCurrency = currencyCode?.trim().length
                ? currencyCode.trim().toUpperCase()
                : "USD";
            const cacheKey = `${normalizedClientId}|${normalizedCurrency}`;
            const existing = sdkLoadersRef.current[cacheKey];
            if (existing) {
                return existing;
            }

            const promise = new Promise<void>((resolve, reject) => {
                if (typeof window === "undefined") {
                    reject(new Error("PayPal checkout is not available in this environment."));
                    return;
                }

                if (window.paypal?.Buttons) {
                    resolve();
                    return;
                }

                const selector = `script[data-paypal-sdk="true"][data-client-id="${normalizedClientId}"][data-currency="${normalizedCurrency}"]`;
                const existingScript = document.querySelector<HTMLScriptElement>(selector);

                const handleError = () => {
                    reject(new Error("Failed to load the PayPal SDK. Please refresh the page and try again."));
                };

                const handleLoad = () => {
                    if (window.paypal?.Buttons) {
                        resolve();
                    } else {
                        reject(new Error("PayPal SDK loaded without the Buttons component."));
                    }
                };

                if (existingScript) {
                    existingScript.addEventListener("load", handleLoad, { once: true });
                    existingScript.addEventListener("error", handleError, { once: true });
                    return;
                }

                const script = document.createElement("script");
                script.type = "text/javascript";
                script.async = true;
                script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(normalizedClientId)}&currency=${encodeURIComponent(normalizedCurrency)}&intent=CAPTURE`;
                script.dataset.paypalSdk = "true";
                script.dataset.clientId = normalizedClientId;
                script.dataset.currency = normalizedCurrency;
                script.addEventListener("load", handleLoad, { once: true });
                script.addEventListener("error", handleError, { once: true });

                document.head.appendChild(script);
            }).catch(err => {
                delete sdkLoadersRef.current[cacheKey];
                throw err;
            });

            sdkLoadersRef.current[cacheKey] = promise;
            return promise;
        },
        []
    );

    useEffect(() => {
        if (!checkoutSession) {
            return;
        }

        if (!payPalConfigured) {
            setPayPalStatus("error");
            setPayPalError("PayPal checkout is not configured. Please contact support.");
            return;
        }

        setPayPalStatus("loading");
        setPayPalError(null);

        loadPayPalSdk(payPalClientId, checkoutSession.currencyCode)
            .then(() => {
                if (!isMountedRef.current) {
                    return;
                }
                setPayPalStatus("ready");
            })
            .catch((err: unknown) => {
                if (!isMountedRef.current) {
                    return;
                }
                setPayPalStatus("error");
                const message =
                    err instanceof Error
                        ? err.message
                        : "Failed to load the PayPal SDK. Please refresh the page and try again.";
                setPayPalError(message);
            });
    }, [checkoutSession, payPalConfigured, payPalClientId, loadPayPalSdk]);

    const finalizePayPalOrder = useCallback(
        async (approvedOrderId: string) => {
            if (!checkoutSession || !userId) {
                setPayPalError("Your checkout session has expired. Please start over.");
                return;
            }

            setPayPalProcessing(true);
            setPayPalError(null);

            try {
                const payload = {
                    userId,
                    cartId: checkoutSession.cartId,
                    fullName: checkoutSession.shipping.fullName,
                    phoneNumber: checkoutSession.shipping.phoneNumber,
                    country: checkoutSession.shipping.country,
                    city: checkoutSession.shipping.city,
                    street: checkoutSession.shipping.street,
                    postalCode: checkoutSession.shipping.postalCode,
                    notes: checkoutSession.shipping.notes || undefined,
                    paymentMethod: "PayPal",
                    payPalOrderId: approvedOrderId,
                };

                const confirmation = await completeOrder(payload);
                if (!isMountedRef.current) {
                    return;
                }

                setCheckoutSession(null);
                setFormData(initialFormState);
                navigate("/orders", {
                    replace: true,
                    state: { highlightOrderId: confirmation.orderId },
                });
            } catch (err: unknown) {
                if (!isMountedRef.current) {
                    return;
                }
                const message = isAxiosError(err)
                    ? err.response?.data?.message ?? err.response?.data ?? err.message
                    : err instanceof Error
                      ? err.message
                      : "Unable to confirm your PayPal payment.";
                setPayPalError(typeof message === "string" ? message : "Unable to confirm your PayPal payment.");
            } finally {
                if (isMountedRef.current) {
                    setPayPalProcessing(false);
                }
            }
        },
        [checkoutSession, navigate, userId]
    );

    useEffect(() => {
        if (payPalStatus !== "ready" || !checkoutSession) {
            return;
        }

        const container = payPalContainerRef.current;
        if (!container) {
            return;
        }

        if (!window.paypal?.Buttons) {
            setPayPalStatus("error");
            setPayPalError("PayPal SDK did not initialise correctly. Please refresh and try again.");
            return;
        }

        container.innerHTML = "";
        if (payPalButtonsRef.current) {
            try {
                payPalButtonsRef.current.close();
            } catch {
                // Ignore cleanup errors.
            }
            payPalButtonsRef.current = null;
        }

        try {
            const buttons = window.paypal.Buttons({
                style: { layout: "vertical", shape: "rect", color: "gold" },
                createOrder: () => checkoutSession.payPalOrderId,
                onApprove: async (data: PayPalButtonsApproveData) => {
                    const approvedOrderId = data.orderID ?? checkoutSession.payPalOrderId;
                    if (!approvedOrderId) {
                        setPayPalError("PayPal did not return an order id. Please try again.");
                        return;
                    }
                    if (payPalProcessing) {
                        return;
                    }
                    await finalizePayPalOrder(approvedOrderId);
                },
                onError: (err: unknown) => {
                    console.error("PayPal Buttons error", err);
                    setPayPalError("We couldn't initialise PayPal checkout. Please try again.");
                },
            });
            payPalButtonsRef.current = buttons;
            void buttons.render(container).catch((err: unknown) => {
                console.error("Failed to render PayPal buttons", err);
                setPayPalError("We couldn't display PayPal checkout. Please refresh the page and try again.");
                payPalButtonsRef.current = null;
            });
        } catch (err) {
            console.error("Failed to set up PayPal buttons", err);
            setPayPalError("We couldn't initialise PayPal checkout. Please try again.");
        }

        return () => {
            if (payPalButtonsRef.current) {
                try {
                    payPalButtonsRef.current.close();
                } catch {
                    // Ignore cleanup errors.
                }
                payPalButtonsRef.current = null;
            }
            container.innerHTML = "";
        };
    }, [payPalStatus, checkoutSession, finalizePayPalOrder, payPalProcessing]);

    const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = event.target;
        setFormData(prev => ({
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
            const trimmedData: CheckoutFormData = {
                fullName: formData.fullName.trim(),
                phoneNumber: formData.phoneNumber.trim(),
                country: formData.country.trim(),
                city: formData.city.trim(),
                street: formData.street.trim(),
                postalCode: formData.postalCode.trim(),
                notes: formData.notes.trim(),
            };

            const payload = {
                userId,
                cartId: cart.id,
                fullName: trimmedData.fullName,
                phoneNumber: trimmedData.phoneNumber,
                country: trimmedData.country,
                city: trimmedData.city,
                street: trimmedData.street,
                postalCode: trimmedData.postalCode,
                notes: trimmedData.notes || undefined,
                paymentMethod: "PayPal",
            };

            const preparation = await createOrder(payload);

            const session: CheckoutSession = {
                shipping: trimmedData,
                items: cart.items.map(item => ({ ...item })),
                totals: {
                    subtotal: preparation.subtotal,
                    shipping: preparation.shipping,
                    total: preparation.grandTotal,
                },
                cartId: cart.id,
                payPalOrderId: preparation.payPalOrderId,
                payPalApprovalUrl: preparation.payPalApprovalUrl ?? null,
                payPalStatus: preparation.payPalStatus ?? null,
                currencyCode: preparation.currencyCode,
            };

            setCheckoutSession(session);
            setFormData(trimmedData);
            setPayPalError(null);
        } catch (err: unknown) {
            const message = isAxiosError(err)
                ? err.response?.data?.message ?? err.response?.data ?? err.message
                : err instanceof Error
                  ? err.message
                  : "Unable to start your checkout.";
            setError(typeof message === "string" ? message : "Unable to start your checkout.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditShipping = useCallback(() => {
        if (!checkoutSession) {
            return;
        }
        setFormData(checkoutSession.shipping);
        setCheckoutSession(null);
    }, [checkoutSession]);

    const hasItems = (cart?.items.length ?? 0) > 0;
    const activeCurrency = checkoutSession?.currencyCode ?? "USD";
    const activeTotals = checkoutSession ? checkoutSession.totals : cartTotals;
    const summaryItems = checkoutSession ? checkoutItemsWithShipping : cartItemsWithShipping;

    return (
        <div className="min-h-screen bg-[#fbfbfa] flex flex-col">
            <Header />
            <main className="flex-1 w-full">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-3xl font-extrabold tracking-wide" style={{ color: "#6B8C8E" }}>
                            Checkout
                        </h1>
                        <p className="text-sm text-gray-600">
                            {checkoutSession
                                ? "Review your shipping details and complete your payment with PayPal."
                                : "Provide your contact and delivery details to continue to PayPal checkout."}
                        </p>
                    </div>

                    {loading ? (
                        <div className="bg-white shadow rounded-lg p-10 text-center text-gray-500">
                            Preparing your checkout details…
                        </div>
                    ) : error ? (
                        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-6">{error}</div>
                    ) : checkoutSession ? (
                        <div className="grid gap-8 lg:grid-cols-[minmax(0,_3fr)_minmax(0,_2fr)]">
                            <section className="bg-white shadow rounded-xl border border-gray-100 p-6 space-y-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h2 className="text-xl font-semibold text-gray-900">Shipping details</h2>
                                        <p className="text-sm text-gray-600">
                                            We’ll ship your order to the address below once the payment is confirmed.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleEditShipping}
                                        className="text-sm font-semibold text-[#6B8C8E] underline"
                                    >
                                        Edit details
                                    </button>
                                </div>

                                <dl className="grid gap-4 sm:grid-cols-2 text-sm text-gray-700">
                                    <div className="space-y-1">
                                        <dt className="font-semibold text-gray-900">Full name</dt>
                                        <dd>{checkoutSession.shipping.fullName || "—"}</dd>
                                    </div>
                                    <div className="space-y-1">
                                        <dt className="font-semibold text-gray-900">Phone</dt>
                                        <dd>{checkoutSession.shipping.phoneNumber || "—"}</dd>
                                    </div>
                                    <div className="space-y-1 sm:col-span-2">
                                        <dt className="font-semibold text-gray-900">Address</dt>
                                        <dd>
                                            {checkoutSession.shipping.street}, {checkoutSession.shipping.city}, {checkoutSession.shipping.country}
                                        </dd>
                                    </div>
                                    <div className="space-y-1">
                                        <dt className="font-semibold text-gray-900">Postal code</dt>
                                        <dd>{checkoutSession.shipping.postalCode || "—"}</dd>
                                    </div>
                                    <div className="space-y-1 sm:col-span-2">
                                        <dt className="font-semibold text-gray-900">Notes</dt>
                                        <dd>{checkoutSession.shipping.notes || "No additional notes"}</dd>
                                    </div>
                                </dl>

                                <div className="space-y-4 border-t border-gray-200 pt-6">
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">Checkout with PayPal</h3>
                                        <p className="text-sm text-gray-600">
                                            You’ll be redirected to PayPal to approve the payment for your order.
                                        </p>
                                    </div>
                                    {payPalProcessing && (
                                        <p className="text-sm text-gray-600">Confirming your PayPal payment…</p>
                                    )}
                                    {payPalStatus === "loading" && !payPalProcessing && (
                                        <p className="text-sm text-gray-600">Loading PayPal checkout…</p>
                                    )}
                                    {payPalError && (
                                        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                                            {payPalError}
                                        </div>
                                    )}
                                    <div ref={payPalContainerRef} className="min-h-[45px]" />
                                    {checkoutSession.payPalApprovalUrl && (
                                        <a
                                            href={checkoutSession.payPalApprovalUrl}
                                            target="_blank"
                                            rel="noreferrer noopener"
                                            className="inline-flex items-center justify-center px-4 py-2 rounded-lg font-semibold text-white shadow"
                                            style={{ backgroundColor: "#003087" }}
                                        >
                                            Open PayPal in a new tab
                                        </a>
                                    )}
                                    {!payPalConfigured && (
                                        <p className="text-xs text-gray-600">
                                            PayPal buttons require configuration. Please contact the store owner to complete the
                                            payment using the approval link above.
                                        </p>
                                    )}
                                </div>
                            </section>

                            <aside className="bg-white shadow rounded-xl border border-gray-100 p-6 h-fit space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-semibold text-gray-900">Order summary</h2>
                                    <Link to="/cart" className="text-sm font-semibold underline" style={{ color: "#6B8C8E" }}>
                                        Edit cart
                                    </Link>
                                </div>
                                <ul className="space-y-3">
                                    {summaryItems.map(({ item, shippingCost }) => {
                                        const jewelry = item.jewelryItem;
                                        const lineTotal = item.priceAtAddTime * item.quantity;
                                        return (
                                            <li key={item.id} className="flex justify-between text-sm text-gray-700">
                                                <div className="pr-4">
                                                    <p className="font-medium">{jewelry?.name ?? `Item #${item.jewelryItemId}`}</p>
                                                    <p className="text-xs text-gray-500">Qty {item.quantity}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p>{formatCurrency(lineTotal, activeCurrency)}</p>
                                                    {shippingCost > 0 && (
                                                        <p className="text-xs text-gray-500">
                                                            Shipping {formatCurrency(shippingCost, activeCurrency)}
                                                        </p>
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                                <div className="flex items-center justify-between text-sm text-gray-700">
                                    <span>Items subtotal</span>
                                    <span>{formatCurrency(activeTotals.subtotal, activeCurrency)}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm text-gray-700">
                                    <span>Estimated shipping</span>
                                    <span>
                                        {activeTotals.shipping > 0
                                            ? formatCurrency(activeTotals.shipping, activeCurrency)
                                            : "Free"}
                                    </span>
                                </div>
                                <hr className="border-gray-200" />
                                <div className="flex items-center justify-between text-lg font-semibold text-gray-900">
                                    <span>Total</span>
                                    <span>{formatCurrency(activeTotals.total, activeCurrency)}</span>
                                </div>
                                <p className="text-xs text-gray-500">
                                    Secure payments are processed after you confirm your PayPal checkout.
                                </p>
                            </aside>
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
                                    {submitting ? "Preparing PayPal checkout…" : "Continue to PayPal"}
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
                                    {summaryItems.map(({ item, shippingCost }) => {
                                        const jewelry = item.jewelryItem;
                                        const lineTotal = item.priceAtAddTime * item.quantity;
                                        return (
                                            <li key={item.id} className="flex justify-between text-sm text-gray-700">
                                                <div className="pr-4">
                                                    <p className="font-medium">{jewelry?.name ?? `Item #${item.jewelryItemId}`}</p>
                                                    <p className="text-xs text-gray-500">Qty {item.quantity}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p>{formatCurrency(lineTotal, activeCurrency)}</p>
                                                    {shippingCost > 0 && (
                                                        <p className="text-xs text-gray-500">
                                                            Shipping {formatCurrency(shippingCost, activeCurrency)}
                                                        </p>
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                                <div className="flex items-center justify-between text-sm text-gray-700">
                                    <span>Items subtotal</span>
                                    <span>{formatCurrency(activeTotals.subtotal, activeCurrency)}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm text-gray-700">
                                    <span>Estimated shipping</span>
                                    <span>
                                        {activeTotals.shipping > 0
                                            ? formatCurrency(activeTotals.shipping, activeCurrency)
                                            : "Free"}
                                    </span>
                                </div>
                                <hr className="border-gray-200" />
                                <div className="flex items-center justify-between text-lg font-semibold text-gray-900">
                                    <span>Total</span>
                                    <span>{formatCurrency(activeTotals.total, activeCurrency)}</span>
                                </div>
                                <p className="text-xs text-gray-500">
                                    Secure payments are processed after you confirm your PayPal checkout.
                                </p>
                            </aside>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
