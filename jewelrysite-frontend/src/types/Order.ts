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
    paymentMethod?: string;
    paymentReference?: string;
    currencyCode?: string;
    taxAmount?: number;
    discountAmount?: number;
}

export interface OrderItem {
    jewelryItemId: number;
    name?: string | null;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
}

export interface OrderConfirmationResponse {
    orderId: number;
    createdAt: string;
    status: string;
    subtotal: number;
    shipping: number;
    taxVat: number;
    discountTotal: number;
    grandTotal: number;
    currencyCode: string;
    paymentProvider?: string | null;
    paymentReference?: string | null;
    payPalOrderId?: string | null;
    payPalApprovalUrl?: string | null;
    payPalStatus?: string | null;
    payPalCaptureId?: string | null;
    items: OrderItem[];
}

export interface OrderSummary {
    orderId: number;
    createdAt: string;
    status: string;
    grandTotal: number;
    currencyCode: string;
    itemCount: number;
}

export interface OrderDetail extends OrderSummary {
    subtotal: number;
    shipping: number;
    taxVat: number;
    discountTotal: number;
    fullName: string;
    phone: string;
    country: string;
    city: string;
    street: string;
    postalCode?: string | null;
    notes?: string | null;
    paymentProvider?: string | null;
    paymentReference?: string | null;
    payPalOrderId?: string | null;
    payPalCaptureId?: string | null;
    payPalStatus?: string | null;
    items: OrderItem[];
}
