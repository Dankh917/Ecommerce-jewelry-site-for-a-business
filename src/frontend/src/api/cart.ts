import { http } from "./http";
import type { CartResponse } from "../types/Cart";

export async function getCart(userId: number): Promise<CartResponse> {
    const res = await http.get<CartResponse>(`/api/Cart`, {
        params: { id: userId },
    });
    return res.data;
}

export async function addItemToCart(
    userId: number,
    jewelryItemId: number,
    quantity: number
): Promise<void> {
    await http.post(`/api/Cart`, null, {
        params: {
            userId,
            jewelryItemId,
            qty: quantity,
        },
    });
}

export async function removeItemFromCart(userId: number, jewelryItemId: number): Promise<void> {
    await http.delete(`/api/Cart`, {
        params: {
            userId,
            jewelryItemId,
        },
    });
}
