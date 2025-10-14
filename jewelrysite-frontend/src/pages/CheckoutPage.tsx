import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
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
    const [checkoutSession, setCheckoutSession] = useState<CheckoutSession | null>(null);
    const [orderConfirmation, setOrderConfirmation] = useState<OrderConfirmation | null>(null);
    const [payPalError, setPayPalError] = useState<string | null>(null);
    const [payPalCapturing, setPayPalCapturing] = useState(false);
    const [payPalPreparing, setPayPalPreparing] = useState(false);
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
    const hasItems = (cart?.items.length ?? 0) > 0;
    const isFormComplete = useMemo(() => {
        const requiredFields = [
            formData.fullName,
            formData.phoneNumber,
            formData.country,
            formData.city,
            formData.street,
            formData.postalCode,
        ];
        return requiredFields.every(field => field.trim().length > 0);
    }, [
        formData.fullName,
        formData.phoneNumber,
        formData.country,
        formData.city,
        formData.street,
        formData.postalCode,
    ]);
    const canRenderPayPalButtons = Boolean(
        payPalConfigured &&
        !orderConfirmation &&
        hasItems &&
        isFormComplete
    );
    const { status: payPalScriptStatus, error: payPalScriptError } = usePayPalScript(
        canRenderPayPalButtons
            ? {
                  clientId: payPalClientId,
                  currency:
                      checkoutSession?.currencyCode ?? orderConfirmation?.order.currencyCode ?? "USD",
                  intent: "CAPTURE",
              }
            : null,
        canRenderPayPalButtons
    );
    const showManualPayPalButton = !shouldRenderPayPalButtons || payPalScriptStatus === "error";
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

    const sessionItemsWithShipping = useMemo(() => {
        if (!checkoutSession) {
            return [] as Array<{ item: CartItemSummary; shippingCost: number }>;
        }
        let shippingChargeAssigned = false;
        return checkoutSession.items.map(item => {
            const shippingPrice = item.jewelryItem?.shippingPrice ?? 0;
            const applyShipping =
                !shippingChargeAssigned && checkoutSession.totals.shipping > 0 &&
                shippingPrice === checkoutSession.totals.shipping;
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

    const preparePayPalCheckout = useCallback(async () => {
        if (!userId || !cart) {
            setPayPalError("You need an active cart to start PayPal checkout.");
            throw new Error("Missing cart or user information");
        }

        const trimmedData: CheckoutFormData = {
            fullName: formData.fullName.trim(),
            phoneNumber: formData.phoneNumber.trim(),
            country: formData.country.trim(),
            city: formData.city.trim(),
            street: formData.street.trim(),
            postalCode: formData.postalCode.trim(),
            notes: formData.notes.trim(),
        };

        const requiredValues = [
            trimmedData.fullName,
            trimmedData.phoneNumber,
            trimmedData.country,
            trimmedData.city,
            trimmedData.street,
            trimmedData.postalCode,
        ];

        if (requiredValues.some(value => value.length === 0)) {
            setPayPalError("Please complete all required shipping fields before paying with PayPal.");
            throw new Error("Shipping details incomplete");
        }

        if (cart.items.length === 0) {
            setPayPalError("Your cart is empty. Please add items before checking out.");
            throw new Error("Cart is empty");
        }

        setPayPalPreparing(true);
        setPayPalError(null);

        try {
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

            const existingItems = cart.items.map(item => ({ ...item }));
            const preparation = await createOrder(payload);

            if (!preparation.payPalOrderId) {
                setPayPalError("PayPal did not return an order id. Please try again.");
                throw new Error("Missing PayPal order id");
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
            setFormData(trimmedData);

            return {
                orderId: preparation.payPalOrderId,
                approvalUrl: preparation.payPalApprovalUrl ?? null,
            };
        } catch (err: unknown) {
            const message = isAxiosError(err)
                ? err.response?.data?.message ?? err.response?.data ?? err.message
                : err instanceof Error
                  ? err.message
                  : "Unable to start PayPal checkout.";
            setPayPalError(typeof message === "string" ? message : "Unable to start PayPal checkout.");
            throw err instanceof Error ? err : new Error("Unable to start PayPal checkout");
        } finally {
            setPayPalPreparing(false);
        }
    }, [userId, cart, formData]);

    const [payPalRedirecting, setPayPalRedirecting] = useState(false);

    const handleManualPayPalCheckout = useCallback(async () => {
        if (payPalPreparing || payPalCapturing || payPalRedirecting) {
            return;
        }

        try {
            setPayPalRedirecting(true);
            const preparation = await preparePayPalCheckout();
            if (preparation.approvalUrl) {
                if (typeof window !== "undefined") {
                    window.location.href = preparation.approvalUrl;
                }
            } else {
                setPayPalError("PayPal did not return an approval link. Please try again.");
            }
        } catch (err) {
            console.error("Failed to start manual PayPal checkout", err);
        } finally {
            setPayPalRedirecting(false);
        }
    }, [payPalPreparing, payPalCapturing, payPalRedirecting, preparePayPalCheckout]);

    useEffect(() => {
        if (!canRenderPayPalButtons) {
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

        if (!container) {
            return;
        }

        if (!window.paypal?.Buttons) {
            setPayPalError("PayPal SDK is unavailable. Please refresh the page and try again.");
            return;
        }

        if (payPalButtonsRef.current) {
            closePayPalButtons();
            container.innerHTML = "";
        }

        setPayPalError(null);

        try {
            const buttons = window.paypal.Buttons({
                style: { layout: "vertical", shape: "rect", color: "gold" },
                createOrder: async () => {
                    if (!userId || !cart) {
                        setPayPalError("You need an active cart to start PayPal checkout.");
                        throw new Error("Missing cart or user information");
                    }

                    const trimmedData: CheckoutFormData = {
                        fullName: formData.fullName.trim(),
                        phoneNumber: formData.phoneNumber.trim(),
                        country: formData.country.trim(),
                        city: formData.city.trim(),
                        street: formData.street.trim(),
                        postalCode: formData.postalCode.trim(),
                        notes: formData.notes.trim(),
                    };

                    const requiredValues = [
                        trimmedData.fullName,
                        trimmedData.phoneNumber,
                        trimmedData.country,
                        trimmedData.city,
                        trimmedData.street,
                        trimmedData.postalCode,
                    ];

                    if (requiredValues.some(value => value.length === 0)) {
                        setPayPalError("Please complete all required shipping fields before paying with PayPal.");
                        throw new Error("Shipping details incomplete");
                    }

                    if (cart.items.length === 0) {
                        setPayPalError("Your cart is empty. Please add items before checking out.");
                        throw new Error("Cart is empty");
                    }

                    setPayPalPreparing(true);
                    setPayPalError(null);

                    try {
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

                        const existingItems = cart.items.map(item => ({ ...item }));
                        const preparation = await createOrder(payload);

                        if (!preparation.payPalOrderId) {
                            setPayPalError("PayPal did not return an order id. Please try again.");
                            throw new Error("Missing PayPal order id");
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
                        setFormData(trimmedData);

                        return preparation.payPalOrderId;
                    } catch (err: unknown) {
                        const message = isAxiosError(err)
                            ? err.response?.data?.message ?? err.response?.data ?? err.message
                            : err instanceof Error
                              ? err.message
                              : "Unable to start PayPal checkout.";
                        setPayPalError(typeof message === "string" ? message : "Unable to start PayPal checkout.");
                        throw err instanceof Error ? err : new Error("Unable to start PayPal checkout");
                    } finally {
                        setPayPalPreparing(false);
                    }
                },
                onApprove: async (data: PayPalApproveData) => {
                    const approvedOrderId = data.orderID ?? checkoutSession?.payPalOrderId ?? null;
                    if (!approvedOrderId) {
                        setPayPalError(
                            "PayPal did not return an order id. Please try again or use the approval link below."
                        );
                        return;
                    }
                    if (payPalCapturing) {
                        return;
                    }
                    await finalizePayPalOrder(approvedOrderId);
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

        return () => {
            if (payPalButtonsRef.current) {
                closePayPalButtons();
            }
            if (payPalContainerRef.current) {
                payPalContainerRef.current.innerHTML = "";
            }
        };
    }, [
        canRenderPayPalButtons,
        payPalScriptStatus,
        userId,
        cart,
        formData,
        payPalCapturing,
        checkoutSession?.payPalOrderId,
        closePayPalButtons,
        finalizePayPalOrder,
        preparePayPalCheckout,
    ]);

    const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = event.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
        setPayPalError(null);
        setCheckoutSession((prev) => {
            if (!prev) {
                return prev;
            }
            return null;
        });
    };

    const summaryItems = checkoutSession && sessionItemsWithShipping.length > 0
        ? sessionItemsWithShipping
        : cartItemsWithShipping;
    const summaryTotals = checkoutSession?.totals ?? totals;

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
                                        {payPalApprovalUrl ? (
                                            <a
                                                href={payPalApprovalUrl}
                                                target="_blank"
                                                rel="noreferrer noopener"
                                                className={`inline-flex items-center justify-center px-4 py-2 rounded-lg font-semibold text-white shadow ${
                                                    payPalCapturing ? "opacity-60 pointer-events-none" : ""
                                                }`}
                                                style={{ backgroundColor: "#003087" }}
                                            >
                                                Continue to PayPal
                                            </a>
                                        ) : (
                                            <p className="text-sm text-gray-600">
                                                Your PayPal payment is still pending. Please finalize it in your PayPal account or contact support if you need assistance.
                                            </p>
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
                    ) : (
                        <div className="grid gap-8 lg:grid-cols-[minmax(0,_3fr)_minmax(0,_2fr)]">
                            <form
                                onSubmit={(event) => event.preventDefault()}
                                className="bg-white shadow rounded-xl border border-gray-100 p-6 space-y-6"
                            >
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

                                <div className="space-y-4 border-t border-gray-200 pt-6">
                                    <h3 className="text-lg font-semibold text-gray-900">Payment</h3>
                                    <p className="text-sm text-gray-600">
                                        Pay securely with PayPal after confirming your shipping details.
                                    </p>
                                    {payPalPreparing && (
                                        <p className="text-sm text-gray-600">Preparing your PayPal checkout…</p>
                                    )}
                                    {payPalCapturing && (
                                        <p className="text-sm text-gray-600">Confirming your PayPal payment…</p>
                                    )}
                                    {canRenderPayPalButtons && payPalScriptStatus === "loading" && (
                                        <p className="text-sm text-gray-600">Loading PayPal checkout…</p>
                                    )}
                                    {payPalError && (
                                        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                                            {payPalError}
                                        </div>
                                    )}
                                    <div
                                        ref={payPalContainerRef}
                                        className={`min-h-[45px] ${!canRenderPayPalButtons ? "opacity-60 pointer-events-none" : ""}`}
                                    />
                                    {checkoutSession?.payPalOrderId && (
                                        <p className="text-xs text-gray-600">
                                            PayPal order <strong>{checkoutSession.payPalOrderId}</strong> — Status: {payPalStatusLabel}
                                        </p>
                                    )}
                                    {payPalApprovalUrl && (
                                        <a
                                            href={payPalApprovalUrl}
                                            target="_blank"
                                            rel="noreferrer noopener"
                                            className={`inline-flex items-center justify-center px-4 py-2 rounded-lg font-semibold text-white shadow ${
                                                payPalCapturing ? "opacity-60 pointer-events-none" : ""
                                            }`}
                                            style={{ backgroundColor: "#003087" }}
                                        >
                                            Continue to PayPal
                                        </a>
                                    )}
                                    {!payPalConfigured && (
                                        <p className="text-xs text-red-600">
                                            PayPal checkout is not configured. Please contact support to complete your purchase.
                                        </p>
                                    )}
                                    {!hasItems && (
                                        <p className="text-xs text-red-600">
                                            Your cart is empty. Please return to the <Link to="/catalog" className="underline">catalog</Link> to add items.
                                        </p>
                                    )}
                                    {payPalConfigured && hasItems && !isFormComplete && (
                                        <p className="text-xs text-gray-500">
                                            Complete all required shipping fields to enable PayPal checkout.
                                        </p>
                                    )}
                                </div>
                            </form>

                            <aside className="bg-white shadow rounded-xl border border-gray-100 p-6 h-fit space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-semibold text-gray-900">Order summary</h2>
                                    <Link to="/cart" className="text-sm font-semibold underline" style={{ color: "#6B8C8E" }}>
                                        Edit cart
                                    </Link>
                                </div>
                                {summaryItems.length === 0 ? (
                                    <p className="text-sm text-gray-600">Your cart is currently empty.</p>
                                ) : (
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
                                                        <p>{formatCurrency(lineTotal)}</p>
                                                        {shippingCost > 0 && (
                                                            <p className="text-xs text-gray-500">Shipping {formatCurrency(shippingCost)}</p>
                                                        )}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                                <div className="flex items-center justify-between text-sm text-gray-700">
                                    <span>Items subtotal</span>
                                    <span>{formatCurrency(summaryTotals.subtotal)}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm text-gray-700">
                                    <span>Estimated shipping</span>
                                    <span>{summaryTotals.shipping > 0 ? formatCurrency(summaryTotals.shipping) : "Free"}</span>
                                </div>
                                <hr className="border-gray-200" />
                                <div className="flex items-center justify-between text-lg font-semibold text-gray-900">
                                    <span>Total</span>
                                    <span>{formatCurrency(summaryTotals.total)}</span>
                                </div>
                                <p className="text-xs text-gray-500">
                                    Secure payments are processed via PayPal once you approve the transaction.
                                </p>
                            </aside>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
