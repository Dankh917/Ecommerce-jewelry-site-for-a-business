export interface CreateOrderPayload {
    userId: number;
    cartId: number;
    fullName: string;
    phoneNumber: string;
    country: string;
    city: string;
    street: string;
    postalCode: string;
    notes?: string;
}

export interface OrderItemSummary {
    jewelryItemId: number;
    quantity: number;
    unitPrice: number;
    name?: string | null;
    lineTotal?: number;
}

export interface OrderResponse {
    id?: number;
    orderNumber?: string;
    totalAmount?: number;
    createdAt?: string;
    estimatedDeliveryDate?: string | null;
    message?: string;
    items?: OrderItemSummary[];
    [key: string]: unknown;
}
