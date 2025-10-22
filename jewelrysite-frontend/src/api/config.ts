import { http } from "./http";

export interface PayPalClientConfigResponse {
    clientId: string;
    baseUrl: string;
}

export async function getPayPalClientConfig(): Promise<PayPalClientConfigResponse> {
    const response = await http.get<PayPalClientConfigResponse>("/api/config/paypal-client-id");
    return response.data;
}
