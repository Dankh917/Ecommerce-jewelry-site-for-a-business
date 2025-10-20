export interface PayPalButtonsActions {
    render(container: HTMLElement | string): Promise<void>;
    close(): Promise<void> | void;
}

export interface PayPalButtonsApproveData {
    orderID?: string;
}

export interface PayPalButtonsConfig {
    style?: Record<string, unknown>;
    createOrder?: () => string | Promise<string>;
    onApprove?: (data: PayPalButtonsApproveData) => void | Promise<void>;
    onError?: (error: unknown) => void;
}

declare global {
    interface Window {
        paypal?: {
            Buttons(config: PayPalButtonsConfig): PayPalButtonsActions;
        };
    }
}

export type PayPalButtonsFactory = (config: PayPalButtonsConfig) => PayPalButtonsActions;

export {};
