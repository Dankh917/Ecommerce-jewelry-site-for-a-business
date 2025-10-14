import { useEffect, useMemo, useState } from "react";

export type PayPalScriptStatus = "idle" | "loading" | "ready" | "error";

export interface PayPalScriptOptions {
    clientId: string;
    currency?: string;
    intent?: "CAPTURE" | "AUTHORIZE";
    components?: string;
}

export interface PayPalScriptResult {
    status: PayPalScriptStatus;
    error: string | null;
}

export interface PayPalApproveData {
    orderID?: string;
}

export interface PayPalButtonsInstance {
    render(container: HTMLElement | string): Promise<void>;
    close(): Promise<void> | void;
}

export interface PayPalButtonsConfig {
    style?: Record<string, unknown>;
    createOrder?: () => string | Promise<string>;
    onApprove?: (data: PayPalApproveData) => void | Promise<void>;
    onError?: (err: unknown) => void;
}

declare global {
    interface Window {
        paypal?: {
            Buttons: (config: PayPalButtonsConfig) => PayPalButtonsInstance;
        };
    }
}

export function usePayPalScript(options: PayPalScriptOptions | null, enabled: boolean): PayPalScriptResult {
    const [status, setStatus] = useState<PayPalScriptStatus>(enabled ? "loading" : "idle");
    const [error, setError] = useState<string | null>(null);

    const scriptUrl = useMemo(() => {
        if (!options || !enabled) {
            return null;
        }
        const query = new URLSearchParams();
        query.set("client-id", options.clientId.trim());
        if (options.currency) {
            query.set("currency", options.currency.trim());
        }
        if (options.intent) {
            query.set("intent", options.intent);
        }
        if (options.components) {
            query.set("components", options.components);
        }
        return `https://www.paypal.com/sdk/js?${query.toString()}`;
    }, [options, enabled]);

    useEffect(() => {
        if (!enabled || !options) {
            setStatus("idle");
            setError(null);
            return;
        }

        if (typeof window === "undefined") {
            setStatus("error");
            setError("PayPal checkout is not available in this environment.");
            return;
        }

        if (!options.clientId || !options.clientId.trim()) {
            setStatus("error");
            setError("A PayPal client id is required to initialize checkout.");
            return;
        }

        const normalizedIntent = options.intent ?? "CAPTURE";
        const normalizedCurrency = options.currency?.trim().toUpperCase() || "USD";
        const scriptId = `paypal-sdk-${options.clientId}-${normalizedCurrency}-${normalizedIntent}`;

        const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
        if (existingScript) {
            if (window.paypal) {
                setStatus("ready");
                setError(null);
                return;
            }

            const handleExistingLoad = () => {
                setStatus("ready");
                setError(null);
            };
            const handleExistingError = () => {
                setStatus("error");
                setError("Failed to load the PayPal SDK. Please refresh the page and try again.");
            };

            existingScript.addEventListener("load", handleExistingLoad, { once: true });
            existingScript.addEventListener("error", handleExistingError, { once: true });

            return () => {
                existingScript.removeEventListener("load", handleExistingLoad);
                existingScript.removeEventListener("error", handleExistingError);
            };
        }

        if (!scriptUrl) {
            setStatus("error");
            setError("Unable to determine the PayPal SDK URL.");
            return;
        }

        setStatus("loading");
        setError(null);

        const script = document.createElement("script");
        script.id = scriptId;
        script.src = scriptUrl;
        script.async = true;
        script.type = "text/javascript";
        script.dataset.paypalSdk = "true";
        script.dataset.paypalCurrency = normalizedCurrency;
        script.dataset.paypalIntent = normalizedIntent;

        const handleLoad = () => {
            setStatus("ready");
            setError(null);
        };

        const handleError = () => {
            setStatus("error");
            setError("Failed to load the PayPal SDK. Please refresh the page and try again.");
        };

        script.addEventListener("load", handleLoad);
        script.addEventListener("error", handleError);

        document.head.appendChild(script);

        return () => {
            script.removeEventListener("load", handleLoad);
            script.removeEventListener("error", handleError);
        };
    }, [enabled, options, scriptUrl]);

    return { status, error };
}
