export function loadPayPalSdk(clientId: string, currency: string): Promise<typeof window.paypal> {
  return new Promise((resolve, reject) => {
    const id = "paypal-sdk";
    if (document.getElementById(id)) {
      return resolve((window as any).paypal);
    }

    const script = document.createElement("script");
    script.id = id;
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}&intent=capture`;
    script.onload = () => resolve((window as any).paypal);
    script.onerror = () => reject(new Error("Failed to load PayPal SDK"));
    document.head.appendChild(script);
  });
}
