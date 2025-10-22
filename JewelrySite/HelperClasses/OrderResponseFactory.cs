using System.Linq;
using JewelrySite.BL;
using JewelrySite.DTO;

namespace JewelrySite.HelperClasses
{
    public static class OrderResponseFactory
    {
        public static OrderConfirmationDto BuildOrderConfirmation(
            Order order,
            string? payPalOrderIdOverride = null,
            string? payPalStatusOverride = null,
            string? approvalUrl = null,
            string? captureIdOverride = null)
        {
            var (storedOrderId, storedCaptureId) = PaymentReferenceHelper.Parse(order.PaymentRef);
            var items = order.Items.Select(oi => new OrderConfirmationItemDto
            {
                JewelryItemId = oi.JewelryItemId,
                Name = oi.NameSnapshot,
                UnitPrice = oi.UnitPrice,
                Quantity = oi.Quantity,
                LineTotal = oi.LineTotal
            }).ToList();

            string? resolvedStatus = payPalStatusOverride;
            if (string.IsNullOrWhiteSpace(resolvedStatus))
            {
                if (!string.IsNullOrWhiteSpace(captureIdOverride ?? storedCaptureId) || order.Status == OrderStatus.Paid)
                {
                    resolvedStatus = "COMPLETED";
                }
                else if (!string.IsNullOrWhiteSpace(payPalOrderIdOverride ?? storedOrderId))
                {
                    resolvedStatus = "CREATED";
                }
            }

            return new OrderConfirmationDto
            {
                OrderId = order.Id,
                CreatedAt = order.CreatedAt,
                Status = order.Status,
                Subtotal = order.Subtotal,
                Shipping = order.Shipping,
                TaxVat = order.TaxVat,
                DiscountTotal = order.DiscountTotal,
                GrandTotal = order.GrandTotal,
                CurrencyCode = order.CurrencyCode,
                PaymentProvider = order.PaymentProvider,
                PaymentReference = order.PaymentRef,
                PayPalOrderId = payPalOrderIdOverride ?? storedOrderId,
                PayPalCaptureId = captureIdOverride ?? storedCaptureId,
                PayPalApprovalUrl = approvalUrl,
                PayPalStatus = resolvedStatus,
                Items = items
            };
        }
    }
}
