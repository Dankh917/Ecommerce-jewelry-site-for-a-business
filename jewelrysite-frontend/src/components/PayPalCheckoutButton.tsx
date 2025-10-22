import { useEffect, useRef } from "react";
import {
    usePayPalScript,
    type PayPalApproveData,
    type PayPalButtonsInstance,
    type PayPalScriptOptions,
    type PayPalScriptStatus,
} from "../hooks/usePayPalScript";

interface PayPalCheckoutButtonProps {
    options: PayPalScriptOptions;
    createOrder: () => Promise<string>;
    onApprove: (data: PayPalApproveData) => Promise<void>;
    onCancel?: () => void;
    onError?: (message: string) => void;
    onStatusChange?: (status: PayPalScriptStatus) => void;
    disabled?: boolean;
    className?: string;
}

export default function PayPalCheckoutButton({
    options,
    createOrder,
    onApprove,
    onCancel,
    onError,
    onStatusChange,
    disabled = false,
    className,
}: PayPalCheckoutButtonProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const buttonsRef = useRef<PayPalButtonsInstance | null>(null);

    const { status, error } = usePayPalScript(options, true);

    useEffect(() => {
        onStatusChange?.(status);
    }, [status, onStatusChange]);

    useEffect(() => {
        if (error) {
            onError?.(error);
        }
    }, [error, onError]);

    useEffect(() => {
        if (status !== "ready") {
            return;
        }

        const container = containerRef.current;
        if (!container) {
            return;
        }

        if (!window.paypal?.Buttons) {
            onError?.("PayPal SDK is unavailable. Please refresh the page and try again.");
            return;
        }

        if (buttonsRef.current) {
            try {
                const result = buttonsRef.current.close();
                if (result && typeof (result as Promise<void>).then === "function") {
                    void (result as Promise<void>).catch(() => undefined);
                }
            } catch {
                // ignore close errors
            }
            buttonsRef.current = null;
        }
        container.innerHTML = "";

        const buttons = window.paypal.Buttons({
            style: { layout: "vertical", shape: "rect", color: "gold" },
            onInit: (_data, actions) => {
                if (disabled) {
                    void actions.disable();
                } else {
                    void actions.enable();
                }
            },
            createOrder: async () => {
                try {
                    const id = await createOrder();
                    if (!id || !id.trim()) {
                        throw new Error("Missing PayPal order id.");
                    }
                    return id;
                } catch (err) {
                    console.error("Failed to create PayPal order", err);
                    onError?.("We couldn't initialize PayPal checkout. Please try again or use the approval link below.");
                    throw err;
                }
            },
            onApprove: async (data: PayPalApproveData) => {
                try {
                    await onApprove(data);
                } catch (err) {
                    console.error("PayPal approval handling failed", err);
                    onError?.("We couldn't confirm your PayPal payment. Please try again or use the approval link below.");
                    throw err;
                }
            },
            onCancel: () => {
                onCancel?.();
            },
            onError: (err: unknown) => {
                console.error("PayPal Buttons error", err);
                onError?.("We couldn't initialize PayPal checkout. Please try again or use the approval link below.");
            },
        });

        buttonsRef.current = buttons;
        void buttons
            .render(container)
            .catch((err: unknown) => {
                console.error("Failed to render PayPal buttons", err);
                onError?.("We couldn't initialize PayPal checkout. Please try again or use the approval link below.");
                buttonsRef.current = null;
            });

        return () => {
            if (buttonsRef.current) {
                try {
                    const result = buttonsRef.current.close();
                    if (result && typeof (result as Promise<void>).then === "function") {
                        void (result as Promise<void>).catch(() => undefined);
                    }
                } catch {
                    // ignore close errors
                }
                buttonsRef.current = null;
            }
            container.innerHTML = "";
        };
    }, [status, disabled, createOrder, onApprove, onCancel, onError]);

    return <div ref={containerRef} className={className} />;
}
