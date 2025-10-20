export interface CartItemSummary {
    id: number;
    cartId: number;
    jewelryItemId: number;
    quantity: number;
    priceAtAddTime: number;
    jewelryItem?: {
        id: number;
        name: string;
        description: string;
        mainImageUrl?: string | null;
        price?: number | null;
        shippingPrice?: number | null;
    } | null;
}

export interface CartResponse {
    id: number;
    userId: number;
    createdAt: string;
    items: CartItemSummary[];
}
