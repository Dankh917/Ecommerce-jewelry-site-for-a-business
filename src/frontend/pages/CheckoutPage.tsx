import { useState } from "react";
import PayPalButton from "../components/PayPalButton";

export default function CheckoutPage() {
  const [clientId] = useState<string>(import.meta.env.VITE_PAYPAL_CLIENT_ID as string);
  const [currency] = useState<string>("USD");

  return (
    <div>
      <h2>Checkout</h2>
      <PayPalButton
        clientId={clientId}
        currency={currency}
        onSuccess={(captureId) => alert(`Payment completed: ${captureId}`)}
        onError={(message) => alert(`Payment error: ${message}`)}
      />
    </div>
  );
}
