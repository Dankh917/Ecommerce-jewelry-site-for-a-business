import { useEffect, useRef } from "react";
import { loadPayPalSdk } from "../lib/loadPayPalSdk";

type Props = {
  clientId: string;
  currency: string;
  onSuccess: (captureId: string) => void;
  onError: (msg: string) => void;
};

export default function PayPalButton({ clientId, currency, onSuccess, onError }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let destroyed = false;
    (async () => {
      try {
        const paypal = await loadPayPalSdk(clientId, currency);
        if (destroyed || !ref.current) return;

        await paypal.Buttons({
          createOrder: async () => {
            const res = await fetch("/api/checkout/paypal/order", {
              method: "POST",
              headers: { "Idempotency-Key": crypto.randomUUID() }
            });
            if (!res.ok) throw new Error("Failed to create order");
            const { orderId } = await res.json();
            return orderId;
          },
          onApprove: async (data: any) => {
            const res = await fetch("/api/checkout/paypal/capture", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": crypto.randomUUID()
              },
              body: JSON.stringify({ orderId: data.orderID })
            });
            if (!res.ok) throw new Error("Capture failed");
            const json = await res.json();
            onSuccess(json.captureId ?? json.CaptureId ?? "unknown");
          },
          onError: (err: any) => onError(String(err))
        }).render(ref.current);
      } catch (error: unknown) {
        if (destroyed) return;
        const message = error instanceof Error ? error.message : "PayPal init error";
        onError(message);
      }
    })();
    return () => {
      destroyed = true;
    };
  }, [clientId, currency, onSuccess, onError]);

  return <div ref={ref} />;
}
