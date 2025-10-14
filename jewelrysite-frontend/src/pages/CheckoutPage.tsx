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
import type { OrderConfirmationResponse } from "../types/Order";
import { usePayPalScript } from "../hooks/usePayPalScript";
import type { PayPalButtonsInstance, PayPalApproveData } from "../hooks/usePayPalScript";

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
    payPalStatus: string | null;
    payPalApprovalUrl: string | null;
    currencyCode: string;
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
    const [checkoutSession, setCheckoutSession] = useState<CheckoutSession | null>(null);
    const [orderConfirmation, setOrderConfirmation] = useState<OrderConfirmation | null>(null);
    const [payPalError, setPayPalError] = useState<string | null>(null);
    const [payPalCapturing, setPayPalCapturing] = useState(false);
    const payPalContainerRef = useRef<HTMLDivElement | null>(null);
    const payPalButtonsRef = useRef<PayPalButtonsInstance | null>(null);

    const closePayPalButtons = useCallback(() => {
        if (!payPalButtonsRef.current) {
            return;
        }
        try {
            const result = payPalButtonsRef.current.close();
            if (result && typeof (result as Promise<void>).then === "function") {
                void (result as Promise<void>).catch(() => undefined);
            }
        } catch (err) {
            console.error("Failed to close PayPal buttons", err);
        } finally {
            payPalButtonsRef.current = null;
        }
    }, []);

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

    const payPalClientId = (import.meta.env.VITE_PAYPAL_CLIENT_ID ?? "").trim();
    const payPalConfigured = payPalClientId.length > 0;
    const rawPayPalStatus = orderConfirmation?.order.payPalStatus ?? checkoutSession?.payPalStatus ?? null;
    const payPalStatus = rawPayPalStatus ? rawPayPalStatus.toUpperCase() : null;
    const payPalOrderId = orderConfirmation?.order.payPalOrderId ?? checkoutSession?.payPalOrderId ?? null;
    const payPalCaptureId = orderConfirmation?.order.payPalCaptureId ?? null;
    const payPalStatusLabel = useMemo(() => {
        if (!payPalStatus) {
            return "Pending";
        }
        return payPalStatus
            .split("_")
            .map(part => part.charAt(0) + part.slice(1).toLowerCase())
            .join(" ");
    }, [payPalStatus]);
    const payPalPaymentCompleted = payPalStatus === "COMPLETED";
    const payPalCurrencyCode = useMemo(() => {
        if (orderConfirmation?.order.currencyCode) {
            return orderConfirmation.order.currencyCode;
        }
        if (checkoutSession?.currencyCode) {
            return checkoutSession.currencyCode;
        }
        return "USD";
    }, [orderConfirmation, checkoutSession]);
    const shouldRenderPayPalButton = Boolean(
        payPalConfigured &&
        checkoutSession &&
        payPalOrderId &&
        !payPalPaymentCompleted &&
        !orderConfirmation
    );
    const { status: payPalScriptStatus, error: payPalScriptError } = usePayPalScript(
        shouldRenderPayPalButton
            ? {
                  clientId: payPalClientId,
                  currency: payPalCurrencyCode,
                  intent: "CAPTURE",
                  components: "buttons",
              }
            : null,
        shouldRenderPayPalButton
    );
    const payPalApprovalUrl = useMemo(() => {
        const raw = orderConfirmation?.order.payPalApprovalUrl ?? checkoutSession?.payPalApprovalUrl ?? null;
        if (!raw) {
            return null;
        }
        try {
            const url = new URL(raw);
            const host = url.hostname.toLowerCase();
            if (!host.endsWith("paypal.com")) {
                return null;
            }
            if (url.protocol !== "https:") {
                return null;
            }
            return url.toString();
        } catch {
            return null;
        }
    }, [orderConfirmation?.order.payPalApprovalUrl, checkoutSession?.payPalApprovalUrl]);

    const formatCurrency = useCallback(
        (value: number, currencyCode: string = payPalCurrencyCode) => {
            return value.toLocaleString(undefined, {
                style: "currency",
                currency: currencyCode,
                currencyDisplay: "code",
                minimumFractionDigits: 2,
            });
        },
        [payPalCurrencyCode]
    );

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

    const sessionItemsWithShipping = useMemo(() => {
        if (!checkoutSession) {
            return [] as Array<{ item: CartItemSummary; shippingCost: number }>;
        }
        let shippingChargeAssigned = false;
        return checkoutSession.items.map(item => {
            const shippingPrice = item.jewelryItem?.shippingPrice ?? 0;
            const applyShipping =
                !shippingChargeAssigned && checkoutSession.totals.shipping > 0 && shippingPrice === checkoutSession.totals.shipping;
            if (applyShipping) {
                shippingChargeAssigned = true;
            }
            return {
                item,
                shippingCost: applyShipping ? checkoutSession.totals.shipping : 0,
            };
        });
    }, [checkoutSession]);

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
        setPayPalError(null);
        setPayPalCapturing(false);
        if (payPalButtonsRef.current) {
            closePayPalButtons();
        }
        if (payPalContainerRef.current) {
            payPalContainerRef.current.innerHTML = "";
        }
    }, [payPalOrderId, closePayPalButtons]);

    useEffect(() => {
        if (payPalScriptError) {
            setPayPalError(payPalScriptError);
        }
    }, [payPalScriptError]);

    const finalizePayPalOrder = useCallback(
        async (approvedOrderId: string) => {
            if (!checkoutSession || !userId) {
                setPayPalError("Your checkout session has expired. Please start over.");
                return;
            }

            setPayPalCapturing(true);
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
                setOrderConfirmation({
                    order: confirmation,
                    shipping: checkoutSession.shipping,
                    items: checkoutSession.items,
                    totals: {
                        subtotal: confirmation.subtotal,
                        shipping: confirmation.shipping,
                        total: confirmation.grandTotal,
                    },
                });
                setCheckoutSession(null);
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
                      : "Unable to confirm PayPal payment.";
                setPayPalError(typeof message === "string" ? message : "Unable to confirm PayPal payment.");
            } finally {
                setPayPalCapturing(false);
            }
        },
        [checkoutSession, userId, setCart, setCheckoutSession, setFormData]
    );

    useEffect(() => {
        if (!shouldRenderPayPalButton) {
            if (payPalButtonsRef.current) {
                closePayPalButtons();
            }
            if (payPalContainerRef.current) {
                payPalContainerRef.current.innerHTML = "";
            }
            return;
        }

        if (payPalScriptStatus !== "ready") {
            return;
        }

        const container = payPalContainerRef.current;

        if (!container || !payPalOrderId || !checkoutSession) {
            return;
        }

        if (!window.paypal?.Buttons) {
            setPayPalError("PayPal SDK is unavailable. Please refresh the page and try again.");
            return;
        }

        if (payPalButtonsRef.current) {
            return;
        }

        try {
            const buttons = window.paypal.Buttons({
                style: {
                    layout: "vertical",
                    shape: "rect",
                    color: "gold",
                    label: "paypal",
                    tagline: false,
                },
                createOrder: () => payPalOrderId,
                onClick: () => {
                    setPayPalError(null);
                },
                onApprove: async (data: PayPalApproveData) => {
                    const approvedOrderId = data.orderID ?? payPalOrderId;
                    if (!approvedOrderId) {
                        setPayPalError(
                            "PayPal did not return an order id. Please use the approval link below."
                        );
                        return;
                    }
                    if (payPalCapturing) {
                        return;
                    }
                    await finalizePayPalOrder(approvedOrderId);
                },
                onCancel: () => {
                    setPayPalError(
                        "You cancelled the PayPal checkout. Select the PayPal button to try again."
                    );
                },
                onError: (err: unknown) => {
                    console.error("PayPal Buttons error", err);
                    setPayPalError(
                        "We couldn't initialize PayPal checkout. Please try again or use the approval link below."
                    );
                },
            });
            payPalButtonsRef.current = buttons;
            void buttons.render(container).catch((err: unknown) => {
                console.error("Failed to render PayPal buttons", err);
                setPayPalError(
                    "We couldn't initialize PayPal checkout. Please try again or use the approval link below."
                );
                payPalButtonsRef.current = null;
            });
        } catch (err) {
            console.error("Failed to set up PayPal buttons", err);
            setPayPalError(
                "We couldn't initialize PayPal checkout. Please try again or use the approval link below."
            );
        }

        const cleanupContainer = container;
        return () => {
            if (payPalButtonsRef.current) {
                closePayPalButtons();
            }
            if (cleanupContainer) {
                cleanupContainer.innerHTML = "";
            }
        };
    }, [
        shouldRenderPayPalButton,
        payPalScriptStatus,
        payPalOrderId,
        checkoutSession,
        payPalCapturing,
        closePayPalButtons,
        finalizePayPalOrder,
    ]);

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
            const trimmedData: CheckoutFormData = {
                fullName: formData.fullName.trim(),
                phoneNumber: formData.phoneNumber.trim(),
                country: formData.country.trim(),
                city: formData.city.trim(),
                street: formData.street.trim(),
                postalCode: formData.postalCode.trim(),
                notes: formData.notes.trim(),
            };

            const paymentMethod = payPalConfigured ? "PayPal" : "Manual";

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
                paymentMethod,
            };

            const existingItems = cart.items.map((item) => ({ ...item }));
            const preparation = await createOrder(payload);

            if (!preparation.requiresPayment) {
                if (preparation.order) {
                    setOrderConfirmation({
                        order: preparation.order,
                        shipping: trimmedData,
                        items: existingItems,
                        totals: {
                            subtotal: preparation.order.subtotal,
                            shipping: preparation.order.shipping,
                            total: preparation.order.grandTotal,
                        },
                    });
                    setCheckoutSession(null);
                    setFormData(initialFormState);

                    try {
                        const refreshedCart = await getCart(userId);
                        setCart(refreshedCart);
                    } catch (refreshError) {
                        console.error("Failed to refresh cart after checkout", refreshError);
                    }
                } else {
                    setError("We were unable to finalize your order. Please try again.");
                }
                return;
            }

            setCheckoutSession({
                shipping: trimmedData,
                items: existingItems,
                totals: {
                    subtotal: preparation.subtotal,
                    shipping: preparation.shipping,
                    total: preparation.grandTotal,
                },
                cartId: cart.id,
                payPalOrderId: preparation.payPalOrderId,
                payPalStatus: preparation.payPalStatus ?? null,
                payPalApprovalUrl: preparation.payPalApprovalUrl ?? null,
                currencyCode: preparation.currencyCode,
            });
            setOrderConfirmation(null);
            setFormData(trimmedData);
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
                        {!orderConfirmation && !checkoutSession && (
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

                            <div className="space-y-3 border-t border-gray-200 pt-6">
                                <h3 className="text-lg font-semibold text-gray-900">Payment</h3>
                                <div className="space-y-1 text-sm text-gray-700">
                                    <p>
                                        <strong>Method:</strong> {orderConfirmation.order.paymentProvider ?? "PayPal"}
                                    </p>
                                    <p>
                                        <strong>Status:</strong> {payPalStatusLabel}
                                    </p>
                                    {payPalOrderId && (
                                        <p>
                                            <strong>PayPal order:</strong> {payPalOrderId}
                                        </p>
                                    )}
                                    {payPalCaptureId && (
                                        <p>
                                            <strong>Capture reference:</strong> {payPalCaptureId}
                                        </p>
                                    )}
                                </div>

                                {payPalPaymentCompleted ? (
                                    <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-3 text-sm">
                                        Your payment has been completed successfully. A receipt has been sent to your PayPal account.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {payPalCapturing && (
                                            <p className="text-sm text-gray-600">Confirming your PayPal payment…</p>
                                        )}
                                        {payPalError && (
                                            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                                                {payPalError}
                                            </div>
                                        )}
                                        {shouldRenderPayPalButton && (
                                            <div className="space-y-2">
                                                {payPalScriptStatus === "loading" && (
                                                    <p className="text-sm text-gray-600">Loading PayPal checkout…</p>
                                                )}
                                                <div ref={payPalContainerRef} className="min-h-[45px]" />
                                            </div>
                                        )}
                                        {payPalApprovalUrl && (
                                            <a
                                                href={payPalApprovalUrl}
                                                target="_blank"
                                                rel="noreferrer noopener"
                                                aria-label="Continue to PayPal to approve this order"
                                                className={`group inline-flex items-center justify-center rounded-full border border-[#003087] bg-[#FFC439] px-5 py-2.5 font-semibold text-[#111B1F] shadow-md transition-transform duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#003087] ${
                                                    payPalCapturing ? "opacity-60 pointer-events-none" : "hover:translate-y-[1px]"
                                                }`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <svg
                                                        aria-hidden="true"
                                                        className="h-6 w-6 drop-shadow-sm"
                                                        viewBox="0 0 32 32"
                                                    >
                                                        <path
                                                            fill="#003087"
                                                            d="M13.7 3.5h7.1c5 0 8.5 2.9 7.6 8.1-.8 4.9-4.4 7.5-9.1 7.5h-3.9l-1.7 10.2h-5.4L13.7 3.5z"
                                                        />
                                                        <path
                                                            fill="#009cde"
                                                            d="M22.4 7.3c2.3 0 3.7 1.2 3.4 3.5-.3 2.2-2 3.5-4.2 3.5h-3.4l1.5-7h2.7z"
                                                        />
                                                    </svg>
                                                    <span className="flex items-baseline gap-1 text-lg leading-none">
                                                        <span className="font-bold text-[#003087]">Pay</span>
                                                        <span className="font-bold text-[#009cde]">Pal</span>
                                                    </span>
                                                </span>
                                            </a>
                                        )}
                                        {!payPalConfigured && payPalApprovalUrl && (
                                            <p className="text-xs text-gray-600">
                                                PayPal buttons require a client id. Use the secure link above to complete your checkout.
                                            </p>
                                        )}
                                    </div>
                                )}
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
                    ) : checkoutSession ? (
                        <div className="bg-white shadow rounded-xl border border-gray-100 p-8 space-y-6">
                            <div className="space-y-2">
                                <h2 className="text-2xl font-semibold text-gray-900">Review & confirm your payment</h2>
                                <p className="text-sm text-gray-600">
                                    Complete the PayPal payment below to finalize your order. We’ll email the confirmation once the payment succeeds.
                                </p>
                                {payPalOrderId && (
                                    <p className="text-sm text-gray-700">
                                        PayPal order reference: <strong>{payPalOrderId}</strong>
                                    </p>
                                )}
                            </div>

                            <div className="grid gap-6 lg:grid-cols-2">
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-gray-900">Shipping details</h3>
                                    <ul className="text-sm text-gray-700 space-y-1">
                                        <li>
                                            <strong>Name:</strong> {checkoutSession.shipping.fullName || "—"}
                                        </li>
                                        <li>
                                            <strong>Phone:</strong> {checkoutSession.shipping.phoneNumber || "—"}
                                        </li>
                                        <li>
                                            <strong>Address:</strong> {checkoutSession.shipping.street}, {checkoutSession.shipping.city}, {checkoutSession.shipping.country}
                                        </li>
                                        <li>
                                            <strong>Postal code:</strong> {checkoutSession.shipping.postalCode || "—"}
                                        </li>
                                        {checkoutSession.shipping.notes && (
                                            <li>
                                                <strong>Notes:</strong> {checkoutSession.shipping.notes}
                                            </li>
                                        )}
                                    </ul>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-gray-900">Order summary</h3>
                                    <ul className="space-y-3 text-sm text-gray-700">
                                        {sessionItemsWithShipping.map(({ item, shippingCost }) => {
                                            const jewelry = item.jewelryItem;
                                            const lineTotal = item.priceAtAddTime * item.quantity;
                                            return (
                                                <li key={`session-${item.id}`} className="flex justify-between">
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
                                            <span>{formatCurrency(checkoutSession.totals.subtotal)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Shipping</span>
                                            <span>
                                                {checkoutSession.totals.shipping > 0
                                                    ? formatCurrency(checkoutSession.totals.shipping)
                                                    : "Free"}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-lg font-semibold text-gray-900 pt-2 border-t border-gray-200">
                                            <span>Total</span>
                                            <span>{formatCurrency(checkoutSession.totals.total)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3 border-t border-gray-200 pt-6">
                                <h3 className="text-lg font-semibold text-gray-900">Payment</h3>
                                <div className="space-y-1 text-sm text-gray-700">
                                    <p>
                                        <strong>Method:</strong> PayPal
                                    </p>
                                    <p>
                                        <strong>Status:</strong> {payPalStatusLabel}
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    {payPalCapturing && (
                                        <p className="text-sm text-gray-600">Confirming your PayPal payment…</p>
                                    )}
                                    {payPalError && (
                                        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                                            {payPalError}
                                        </div>
                                    )}
                                    {shouldRenderPayPalButton && (
                                        <div className="space-y-2">
                                            {payPalScriptStatus === "loading" && (
                                                <p className="text-sm text-gray-600">Loading PayPal checkout…</p>
                                            )}
                                            <div ref={payPalContainerRef} className="min-h-[45px]" />
                                        </div>
                                    )}
                                        {payPalApprovalUrl && (
                                            <a
                                                href={payPalApprovalUrl}
                                                target="_blank"
                                                rel="noreferrer noopener"
                                                aria-label="Continue to PayPal to approve this order"
                                                className={`group inline-flex items-center justify-center rounded-full border border-[#003087] bg-[#FFC439] px-5 py-2.5 font-semibold text-[#111B1F] shadow-md transition-transform duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#003087] ${
                                                    payPalCapturing ? "opacity-60 pointer-events-none" : "hover:translate-y-[1px]"
                                                }`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <svg
                                                        aria-hidden="true"
                                                        className="h-6 w-6 drop-shadow-sm"
                                                        viewBox="0 0 32 32"
                                                    >
                                                        <path
                                                            fill="#003087"
                                                            d="M13.7 3.5h7.1c5 0 8.5 2.9 7.6 8.1-.8 4.9-4.4 7.5-9.1 7.5h-3.9l-1.7 10.2h-5.4L13.7 3.5z"
                                                        />
                                                        <path
                                                            fill="#009cde"
                                                            d="M22.4 7.3c2.3 0 3.7 1.2 3.4 3.5-.3 2.2-2 3.5-4.2 3.5h-3.4l1.5-7h2.7z"
                                                        />
                                                    </svg>
                                                    <span className="flex items-baseline gap-1 text-lg leading-none">
                                                        <span className="font-bold text-[#003087]">Pay</span>
                                                        <span className="font-bold text-[#009cde]">Pal</span>
                                                    </span>
                                                </span>
                                            </a>
                                        )}
                                    {payPalOrderId && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (payPalOrderId) {
                                                    void finalizePayPalOrder(payPalOrderId);
                                                }
                                            }}
                                            disabled={payPalCapturing}
                                            className="inline-flex items-center justify-center px-4 py-2 rounded-lg font-semibold text-white shadow disabled:opacity-60"
                                            style={{ backgroundColor: "#6B8C8E" }}
                                        >
                                            {payPalCapturing ? "Confirming payment…" : "I've completed my PayPal payment"}
                                        </button>
                                    )}
                                    {!payPalConfigured && payPalApprovalUrl && (
                                        <p className="text-xs text-gray-600">
                                            PayPal buttons require a client id. Use the secure link above to complete your checkout.
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    onClick={() => setCheckoutSession(null)}
                                    className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-white font-semibold shadow"
                                    style={{ backgroundColor: "#6B8C8E" }}
                                >
                                    Edit shipping details
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
                                    {payPalConfigured
                                        ? submitting
                                            ? "Preparing PayPal checkout…"
                                            : "Review & pay with PayPal"
                                        : submitting
                                          ? "Placing your order…"
                                          : "Place order"}
                                </button>
                                {payPalConfigured && (
                                    <p className="text-xs text-gray-500">
                                        You’ll securely complete your purchase through PayPal after reviewing the order
                                        summary.
                                    </p>
                                )}
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
                            </aside>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
