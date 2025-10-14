import { http } from "./http";
import type {
    CheckoutPreparationResponse,
    CompleteOrderPayload,
    CreateOrderPayload,
    OrderConfirmationResponse,
    OrderDetail,
    OrderSummary,
} from "../types/Order";

export async function createOrder(payload: CreateOrderPayload): Promise<CheckoutPreparationResponse> {
    const res = await http.post<CheckoutPreparationResponse>("/api/Orders", payload);
    return res.data;
}

export async function completeOrder(payload: CompleteOrderPayload): Promise<OrderConfirmationResponse> {
    const res = await http.post<OrderConfirmationResponse>("/api/Orders/complete", payload);
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
