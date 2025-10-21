import { useMemo, useState } from "react";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import type { CartItemSummary } from "../types/Cart";

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

const scriptOptions = {
    "client-id": "test",
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
                id: String(item.jewelryItemId ?? item.id),
                quantity: String(item.quantity),
            })),
        [cartItems],
    );

    return (
        <PayPalScriptProvider options={scriptOptions}>
            <div className="space-y-2">
                <PayPalButtons
                    fundingSource="paypal"
                    style={buttonStyle}
                    disabled={disabled}
                    createOrder={async () => {
                        try {
                            const response = await fetch("/api/orders", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({
                                    cart: cartPayload,
                                }),
                            });

                            if (!response.ok) {
                                throw new Error(`Failed to create order. Status: ${response.status}`);
                            }

                            const orderData = (await response.json()) as PayPalOrderResponse;

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
                            setMessage(`Could not initiate PayPal Checkout. ${(error as Error).message}`);
                            throw error;
                        }
                    }}
                    onApprove={async (data, actions) => {
                        try {
                            const response = await fetch(`/api/orders/${data.orderID}/capture`, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                            });

                            if (!response.ok) {
                                throw new Error(`Failed to capture order. Status: ${response.status}`);
                            }

                            const orderData = (await response.json()) as PayPalOrderResponse;
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
                            setMessage(`Sorry, your transaction could not be processed. ${(error as Error).message}`);
                        }
                    }}
                />
                {message && <p className="text-sm text-gray-600">{message}</p>}
            </div>
        </PayPalScriptProvider>
    );
}
