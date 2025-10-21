import { useMemo, useState } from "react";
import axios from "axios";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import type { CartItemSummary } from "../types/Cart";
import { http } from "../api/http";

interface PayPalCheckoutButtonProps {
    cartItems: CartItemSummary[];
    disabled?: boolean;
}

interface PayPalOrderErrorDetail {
    issue?: string;
    description?: string;
}

interface PayPalCapture {
    id?: string;
    status?: string;
}

interface PayPalPurchaseUnit {
    payments?: {
        captures?: PayPalCapture[];
    };
}

interface PayPalOrderResponse {
    id?: string;
    details?: PayPalOrderErrorDetail[];
    debug_id?: string;
    purchase_units?: PayPalPurchaseUnit[];
}

const paypalClientId = import.meta.env.VITE_PAYPAL_CLIENT_ID || "test";

const scriptOptions = {
    "client-id": paypalClientId,
    "enable-funding": "",
    "disable-funding": "venmo,paylater,card",
    "buyer-country": "US",
    currency: "USD",
    "data-page-type": "product-details",
    components: "buttons",
    "data-sdk-integration-source": "developer-studio",
} as const;

const buttonStyle = {
    shape: "pill" as const,
    layout: "vertical" as const,
    color: "gold" as const,
    label: "checkout" as const,
};

export default function PayPalCheckoutButton({ cartItems, disabled }: PayPalCheckoutButtonProps) {
    const [message, setMessage] = useState<string>("");

    const cartPayload = useMemo(
        () =>
            cartItems.map((item) => ({
                id: String(item.id),
                quantity: String(item.quantity),
            })),
        [cartItems],
    );

    const createOrderErrorMessage = (error: unknown) => {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const details =
                (error.response?.data as { error?: string } | undefined)?.error ?? error.message ?? "Unknown error";
            return `Failed to create order${status ? ` (status ${status})` : ""}. ${details}`;
        }
        return (error as Error).message;
    };

    const captureOrderErrorMessage = (error: unknown) => {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const details =
                (error.response?.data as { error?: string } | undefined)?.error ?? error.message ?? "Unknown error";
            return `Failed to capture order${status ? ` (status ${status})` : ""}. ${details}`;
        }
        return (error as Error).message;
    };

    return (
        <PayPalScriptProvider options={scriptOptions}>
            <div className="space-y-2">
                <PayPalButtons
                    fundingSource="paypal"
                    style={buttonStyle}
                    disabled={disabled}
                    createOrder={async () => {
                        try {
                            const response = await http.post<PayPalOrderResponse>("/api/paypal/orders", {
                                cart: cartPayload,
                            });
                            const orderData = response.data;

                            if (orderData.id) {
                                return orderData.id;
                            }

                            const errorDetail = orderData.details?.[0];
                            const errorMessage = errorDetail
                                ? `${errorDetail.issue ?? "Unknown issue"} ${errorDetail.description ?? ""} (${
                                      orderData.debug_id ?? "no_debug_id"
                                  })`
                                : JSON.stringify(orderData);
                            throw new Error(errorMessage);
                        } catch (error) {
                            console.error(error);
                            setMessage(`Could not initiate PayPal Checkout. ${createOrderErrorMessage(error)}`);
                            throw error instanceof Error ? error : new Error(createOrderErrorMessage(error));
                        }
                    }}
                    onApprove={async (data, actions) => {
                        try {
                            const response = await http.post<PayPalOrderResponse>(
                                `/api/paypal/orders/${data.orderID}/capture`,
                            );
                            const orderData = response.data;
                            const errorDetail = orderData.details?.[0];

                            if (errorDetail?.issue === "INSTRUMENT_DECLINED") {
                                if (actions?.restart) {
                                    return actions.restart();
                                }
                                setMessage("Payment method was declined. Please try another method.");
                                return;
                            }

                            if (errorDetail) {
                                throw new Error(`${errorDetail.description ?? "Transaction failed"} (${orderData.debug_id ?? "no_debug_id"})`);
                            }

                            const capture = orderData.purchase_units?.[0]?.payments?.captures?.[0];

                            if (capture?.status && capture.id) {
                                setMessage(`Transaction ${capture.status}: ${capture.id}. See console for all available details.`);
                            } else {
                                setMessage("Transaction completed. See console for additional details.");
                            }

                            console.log("PayPal capture result", orderData);
                        } catch (error) {
                            console.error(error);
                            setMessage(`Sorry, your transaction could not be processed. ${captureOrderErrorMessage(error)}`);
                        }
                    }}
                />
                {message && <p className="text-sm text-gray-600">{message}</p>}
            </div>
        </PayPalScriptProvider>
    );
}
