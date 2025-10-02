import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import { useAuth } from "../context/AuthContext";
import { resolveUserId } from "../utils/user";
import { getOrderDetail, getOrders } from "../api/orders";
import type { OrderDetail, OrderSummary } from "../types/Order";
import { isAxiosError } from "axios";

export default function OrdersPage() {
    const { user, jwtToken } = useAuth();
    const userId = useMemo(() => resolveUserId(user, jwtToken), [user, jwtToken]);

    const [orders, setOrders] = useState<OrderSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            setOrders([]);
            setSelectedOrder(null);
            return;
        }

        let active = true;
        setLoading(true);
        setError(null);

        (async () => {
            try {
                const data = await getOrders(userId);
                if (!active) return;
                setOrders(data);
            } catch (err: unknown) {
                if (!active) return;
                const message = isAxiosError(err)
                    ? err.response?.data?.message ?? err.response?.data ?? err.message
                    : err instanceof Error
                      ? err.message
                      : "Unable to load your orders.";
                setError(typeof message === "string" ? message : "Unable to load your orders.");
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            active = false;
        };
    }, [userId]);

    useEffect(() => {
        if (!selectedOrder) {
            return;
        }

        const exists = orders.some(order => order.orderId === selectedOrder.orderId);
        if (!exists) {
            setSelectedOrder(null);
        }
    }, [orders, selectedOrder]);

    const formatCurrency = useCallback((value: number, currencyCode: string) => {
        const safeCurrency = currencyCode && currencyCode.trim().length === 3 ? currencyCode : "USD";
        return value.toLocaleString(undefined, {
            style: "currency",
            currency: safeCurrency,
            currencyDisplay: "code",
            minimumFractionDigits: 2,
        });
    }, []);

    const formatDateTime = useCallback((iso: string) => {
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) {
            return iso;
        }
        return date.toLocaleString();
    }, []);

    const handleSelectOrder = useCallback(
        async (orderId: number) => {
            if (!userId) {
                return;
            }

            if (selectedOrder?.orderId === orderId) {
                setSelectedOrder(null);
                setDetailError(null);
                return;
            }

            setDetailLoading(true);
            setDetailError(null);
            try {
                const detail = await getOrderDetail(orderId, userId);
                setSelectedOrder(detail);
            } catch (err: unknown) {
                const message = isAxiosError(err)
                    ? err.response?.data?.message ?? err.response?.data ?? err.message
                    : err instanceof Error
                      ? err.message
                      : "Unable to load the order details.";
                setDetailError(typeof message === "string" ? message : "Unable to load the order details.");
            } finally {
                setDetailLoading(false);
            }
        },
        [selectedOrder, userId]
    );

    return (
        <div className="min-h-screen bg-[#F8F9FA]">
            <Header />
            <main className="max-w-6xl mx-auto px-4 py-10">
                <div className="bg-white shadow rounded-xl border border-gray-100 p-6 space-y-6">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-3xl font-bold text-gray-900">My orders</h1>
                        <p className="text-sm text-gray-600">
                            Track your purchases and review the details of every order you have placed.
                        </p>
                    </div>

                    {!userId ? (
                        <div className="bg-blue-50 border border-blue-100 text-blue-800 rounded-lg p-6">
                            <p className="text-sm">
                                Please <Link to="/login" className="font-semibold underline">log in</Link> to view your orders.
                            </p>
                        </div>
                    ) : loading ? (
                        <div className="text-center text-gray-500 py-10">Loading your orders…</div>
                    ) : error ? (
                        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-6">{error}</div>
                    ) : orders.length === 0 ? (
                        <div className="text-center text-gray-500 py-10">You haven’t placed any orders yet.</div>
                    ) : (
                        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                            <section className="space-y-4">
                                {orders.map(order => (
                                    <article
                                        key={order.orderId}
                                        className="border border-gray-200 rounded-lg p-4 flex flex-col gap-3 bg-gray-50"
                                    >
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-700">
                                                    Order <span className="text-gray-900">#{order.orderId}</span>
                                                </p>
                                                <p className="text-xs text-gray-500">Placed on {formatDateTime(order.createdAt)}</p>
                                            </div>
                                            <span className="inline-flex items-center rounded-full bg-[#E3F0F2] px-3 py-1 text-xs font-semibold text-[#2F4F4F]">
                                                {order.status}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-700">
                                            <span>
                                                {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
                                            </span>
                                            <span className="font-semibold">
                                                {formatCurrency(order.grandTotal, order.currencyCode)}
                                            </span>
                                            <button
                                                type="button"
                                                className="text-[#2F4F4F] font-semibold hover:underline"
                                                onClick={() => void handleSelectOrder(order.orderId)}
                                                disabled={detailLoading && selectedOrder?.orderId !== order.orderId}
                                            >
                                                {selectedOrder?.orderId === order.orderId ? "Hide details" : "View details"}
                                            </button>
                                        </div>
                                    </article>
                                ))}
                            </section>

                            <aside className="border border-gray-200 rounded-lg p-5 bg-white space-y-4">
                                <h2 className="text-xl font-semibold text-gray-900">Order details</h2>
                                {detailLoading ? (
                                    <div className="text-sm text-gray-500">Fetching order information…</div>
                                ) : detailError ? (
                                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">{detailError}</div>
                                ) : selectedOrder ? (
                                    <div className="space-y-4 text-sm text-gray-700">
                                        <div>
                                            <p className="font-semibold text-gray-900">Order #{selectedOrder.orderId}</p>
                                            <p className="text-xs text-gray-500">
                                                Placed on {formatDateTime(selectedOrder.createdAt)}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p>
                                                <strong>Status:</strong> {selectedOrder.status}
                                            </p>
                                            <p>
                                                <strong>Total:</strong> {formatCurrency(selectedOrder.grandTotal, selectedOrder.currencyCode)}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-semibold text-gray-900">Shipping information</p>
                                            <p>{selectedOrder.fullName}</p>
                                            <p>{selectedOrder.street}</p>
                                            <p>
                                                {selectedOrder.city}, {selectedOrder.country} {selectedOrder.postalCode ?? ""}
                                            </p>
                                            <p>Phone: {selectedOrder.phone}</p>
                                            {selectedOrder.notes && <p>Notes: {selectedOrder.notes}</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <p className="font-semibold text-gray-900">Items</p>
                                            <ul className="space-y-2">
                                                {selectedOrder.items.map(item => (
                                                    <li key={`${item.jewelryItemId}-${item.name ?? "item"}`} className="flex justify-between gap-3">
                                                        <span>
                                                            {item.name ?? `Item #${item.jewelryItemId}`} x {item.quantity}
                                                        </span>
                                                        <span className="font-semibold">
                                                            {formatCurrency(item.lineTotal, selectedOrder.currencyCode)}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="border-t border-gray-200 pt-3 space-y-1">
                                            <div className="flex justify-between">
                                                <span>Subtotal</span>
                                                <span>{formatCurrency(selectedOrder.subtotal, selectedOrder.currencyCode)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Shipping</span>
                                                <span>
                                                    {selectedOrder.shipping > 0
                                                        ? formatCurrency(selectedOrder.shipping, selectedOrder.currencyCode)
                                                        : "Free"}
                                                </span>
                                            </div>
                                            {selectedOrder.taxVat > 0 && (
                                                <div className="flex justify-between">
                                                    <span>Tax / VAT</span>
                                                    <span>{formatCurrency(selectedOrder.taxVat, selectedOrder.currencyCode)}</span>
                                                </div>
                                            )}
                                            {selectedOrder.discountTotal > 0 && (
                                                <div className="flex justify-between text-green-700">
                                                    <span>Discount</span>
                                                    <span>-{formatCurrency(selectedOrder.discountTotal, selectedOrder.currencyCode)}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between font-semibold text-gray-900">
                                                <span>Grand total</span>
                                                <span>{formatCurrency(selectedOrder.grandTotal, selectedOrder.currencyCode)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-500">Select an order to view its details.</div>
                                )}
                            </aside>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
