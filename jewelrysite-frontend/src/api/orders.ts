import { http } from "./http";
import type { CreateOrderPayload, OrderResponse } from "../types/Order";

export async function createOrder(payload: CreateOrderPayload): Promise<OrderResponse> {
    const res = await http.post<OrderResponse>("/api/Orders", payload);
    return res.data;
}
