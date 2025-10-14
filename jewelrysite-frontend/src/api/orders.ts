import { http } from "./http";
import type {
    CreateOrderPayload,
    OrderConfirmationResponse,
    OrderDetail,
    OrderSummary,
} from "../types/Order";

export async function createOrder(payload: CreateOrderPayload): Promise<OrderConfirmationResponse> {
    const res = await http.post<OrderConfirmationResponse>("/api/Orders", payload);
    return res.data;
}

export async function captureOrder(
    orderId: number,
    payPalOrderId: string
): Promise<OrderConfirmationResponse> {
    const res = await http.post<OrderConfirmationResponse>(`/api/Orders/${orderId}/capture`, {
        payPalOrderId,
    });
    return res.data;
}

export async function getOrders(userId?: number): Promise<OrderSummary[]> {
    const res = await http.get<OrderSummary[]>("/api/Orders", {
        params: userId ? { userId } : undefined,
    });
    return res.data;
}

export async function getOrderDetail(orderId: number, userId?: number): Promise<OrderDetail> {
    const res = await http.get<OrderDetail>(`/api/Orders/${orderId}`, {
        params: userId ? { userId } : undefined,
    });
    return res.data;
}
