import {
    createContext,
    type PropsWithChildren,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

type ScriptStatus = "pending" | "resolved" | "rejected";

export interface ReactPayPalScriptOptions {
    clientId: string;
    components?: string;
    currency?: string;
}

interface PayPalScriptContextValue {
    options: ReactPayPalScriptOptions;
    status: ScriptStatus;
    error: Error | null;
}

type PayPalButtonsComponentProps = Record<string, unknown>;

const PayPalScriptContext = createContext<PayPalScriptContextValue | null>(null);

interface ScriptRecord {
    promise: Promise<void>;
    status: ScriptStatus;
    error: Error | null;
}

const scriptCache = new Map<string, ScriptRecord>();

declare global {
    interface Window {
        paypal?: {
            Buttons: (options?: Record<string, unknown>) => {
                render: (selectorOrElement: HTMLElement | string) => Promise<void>;
                close: () => Promise<void> | void;
            };
        };
    }
}

function buildScriptUrl(options: ReactPayPalScriptOptions): string {
    const params = new URLSearchParams();
    params.set("client-id", options.clientId);
    params.set("components", options.components ?? "buttons");
    if (options.currency) {
        params.set("currency", options.currency);
    }
    return `https://www.paypal.com/sdk/js?${params.toString()}`;
}

function loadPayPalScript(options: ReactPayPalScriptOptions): ScriptRecord {
    if (typeof window === "undefined") {
        const promise = Promise.resolve();
        return { promise, status: "resolved", error: null };
    }

    const url = buildScriptUrl(options);

    const cached = scriptCache.get(url);
    if (cached) {
        return cached;
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${url}"]`);
    if (existing && (existing as HTMLScriptElement).dataset.paypalSdkLoaded === "true") {
        const promise = Promise.resolve();
        const record: ScriptRecord = { promise, status: "resolved", error: null };
        scriptCache.set(url, record);
        return record;
    }

    const script = existing ?? document.createElement("script");
    script.src = url;
    script.async = true;
    script.dataset.sdkIntegrationSource = script.dataset.sdkIntegrationSource ?? "react-paypal-js";

    const promise = new Promise<void>((resolve, reject) => {
        const handleLoad = () => {
            script.dataset.paypalSdkLoaded = "true";
            record.status = "resolved";
            resolve();
        };
        const handleError = () => {
            const error = new Error("Failed to load the PayPal SDK script.");
            record.status = "rejected";
            record.error = error;
            reject(error);
        };

        if (script.dataset.paypalSdkLoaded === "true" || window.paypal) {
            handleLoad();
            return;
        }

        script.addEventListener("load", handleLoad, { once: true });
        script.addEventListener("error", handleError, { once: true });
    });

    const record: ScriptRecord = { promise, status: "pending", error: null };
    if (!existing) {
        document.head.appendChild(script);
    }
    scriptCache.set(url, record);
    return record;
}

export function PayPalScriptProvider({ options, children }: PropsWithChildren<{ options: ReactPayPalScriptOptions }>) {
    const [status, setStatus] = useState<ScriptStatus>("pending");
    const [error, setError] = useState<Error | null>(null);

    const normalizedOptions = useMemo(() => ({ ...options }), [options]);

    useEffect(() => {
        let cancelled = false;
        const record = loadPayPalScript(normalizedOptions);
        record.promise
            .then(() => {
                if (cancelled) return;
                setStatus("resolved");
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                setStatus("rejected");
                setError(err instanceof Error ? err : new Error("Failed to load PayPal SDK."));
            });

        return () => {
            cancelled = true;
        };
    }, [normalizedOptions]);

    const contextValue = useMemo<PayPalScriptContextValue>(
        () => ({
            options: normalizedOptions,
            status,
            error,
        }),
        [normalizedOptions, status, error],
    );

    return <PayPalScriptContext.Provider value={contextValue}>{children}</PayPalScriptContext.Provider>;
}

export function PayPalButtons(props: PayPalButtonsComponentProps) {
    const context = useContext(PayPalScriptContext);
    if (!context) {
        throw new Error("PayPalButtons must be used within a PayPalScriptProvider.");
    }

    const containerRef = useRef<HTMLDivElement | null>(null);
    const [renderError, setRenderError] = useState<Error | null>(null);

    useEffect(() => {
        if (context.status !== "resolved") {
            return;
        }

        if (typeof window === "undefined" || !window.paypal || typeof window.paypal.Buttons !== "function") {
            setRenderError(new Error("PayPal Buttons are unavailable."));
            return;
        }

        if (!containerRef.current) {
            return;
        }

        const buttonInstance = window.paypal.Buttons({ ...props });
        let cancelled = false;

        buttonInstance
            .render(containerRef.current)
            .catch((error: unknown) => {
                if (cancelled) return;
                setRenderError(error instanceof Error ? error : new Error("Failed to render PayPal Buttons."));
            });

        return () => {
            cancelled = true;
            if (buttonInstance && typeof buttonInstance.close === "function") {
                void buttonInstance.close();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [context.status, JSON.stringify(props)]);

    if (context.status === "pending") {
        return <div ref={containerRef} />;
    }

    if (context.status === "rejected" || renderError) {
        return <div ref={containerRef} />;
    }

    return <div ref={containerRef} />;
}

export function usePayPalScriptContext() {
    const context = useContext(PayPalScriptContext);
    if (!context) {
        throw new Error("usePayPalScriptContext must be used within a PayPalScriptProvider.");
    }
    return context;
}
