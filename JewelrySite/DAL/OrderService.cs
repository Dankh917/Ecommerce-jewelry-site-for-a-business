using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using JewelrySite.BL;
using JewelrySite.DTO;
using JewelrySite.HelperClasses;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace JewelrySite.DAL
{
        public class OrderService
        {
                private readonly JewerlyStoreDBContext _dbContext;
                private readonly PayPalClient _payPalClient;
                private readonly ILogger<OrderService> _logger;
                private readonly PayPalOptions _payPalOptions;
                private readonly IHttpContextAccessor _httpContextAccessor;

                public OrderService(JewerlyStoreDBContext dbContext, PayPalClient payPalClient, IOptions<PayPalOptions> payPalOptions, ILogger<OrderService> logger, IHttpContextAccessor httpContextAccessor)
                {
                        _dbContext = dbContext;
                        _payPalClient = payPalClient;
                        _logger = logger;
                        _payPalOptions = payPalOptions.Value;
                        _httpContextAccessor = httpContextAccessor;
                }

                public async Task<CheckoutPreparationResult> PrepareCheckoutAsync(int userId, CreateOrderRequestDto request, CancellationToken cancellationToken = default)
                {
                        if (request is null)
                        {
                                throw new ArgumentNullException(nameof(request));
                        }

                        var draft = await BuildOrderDraftAsync(userId, request, cancellationToken);

                        var payPalRequest = BuildPayPalRequest(draft);
                        var payPalResponse = await _payPalClient.CreateOrderAsync(payPalRequest, cancellationToken);

                        return new CheckoutPreparationResult(
                                draft.Subtotal,
                                draft.Shipping,
                                draft.Tax,
                                draft.Discount,
                                draft.GrandTotal,
                                draft.CurrencyCode,
                                draft.Items,
                                payPalResponse.Id,
                                payPalResponse.Status,
                                payPalResponse.GetApprovalLink()
                        );
                }

                public Task<List<Order>> GetOrdersForUserAsync(int userId, CancellationToken cancellationToken = default)
                {
                        return _dbContext.Orders
                                .AsNoTracking()
                                .Where(o => o.UserId == userId)
                                .Include(o => o.Items)
                                .OrderByDescending(o => o.CreatedAt)
                                .ToListAsync(cancellationToken);
                }

                public Task<Order?> GetOrderForUserAsync(int userId, int orderId, CancellationToken cancellationToken = default)
                {
                        return _dbContext.Orders
                                .AsNoTracking()
                                .Include(o => o.Items)
                                .FirstOrDefaultAsync(o => o.Id == orderId && o.UserId == userId, cancellationToken);
                }

                public async Task<OrderCompletionResult> CompleteOrderAsync(int userId, CompleteOrderRequestDto request, CancellationToken cancellationToken = default)
                {
                        if (request is null)
                        {
                                throw new ArgumentNullException(nameof(request));
                        }

                        if (string.IsNullOrWhiteSpace(request.PayPalOrderId))
                        {
                                throw new ArgumentException("PayPal order id is required for completion.", nameof(request.PayPalOrderId));
                        }

                        var existingOrders = await _dbContext.Orders
                                .Include(o => o.Items)
                                .Where(o => o.UserId == userId && o.PaymentProvider == "PayPal" && o.PaymentRef != null)
                                .ToListAsync(cancellationToken);

                        foreach (var existing in existingOrders)
                        {
                                var (storedOrderId, storedCaptureId) = PaymentReferenceHelper.Parse(existing.PaymentRef);
                                if (string.Equals(storedOrderId, request.PayPalOrderId, StringComparison.Ordinal))
                                {
                                        var resolvedStatus = existing.Status == OrderStatus.Paid
                                                ? "COMPLETED"
                                                : existing.Status.ToString().ToUpperInvariant();
                                        return new OrderCompletionResult(existing, request.PayPalOrderId, resolvedStatus, storedCaptureId);
                                }
                        }

                        await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

                        var draft = await BuildOrderDraftAsync(userId, request, cancellationToken);

                        var captureResponse = await _payPalClient.CaptureOrderAsync(request.PayPalOrderId, cancellationToken);
                        var captureStatus = captureResponse.Status?.ToUpperInvariant();
                        if (!string.Equals(captureStatus, "COMPLETED", StringComparison.Ordinal))
                        {
                                throw new InvalidOperationException("PayPal did not confirm the payment capture.");
                        }

                        var captureId = captureResponse.GetCaptureId();

                        var order = new Order
                        {
                                UserId = userId,
                                Status = OrderStatus.Paid,
                                CreatedAt = DateTime.UtcNow,
                                PaidAt = DateTime.UtcNow,
                                FullName = request.FullName,
                                Phone = request.Phone,
                                Country = request.Country,
                                City = request.City,
                                Street = request.Street,
                                PostalCode = request.PostalCode,
                                Notes = request.PaymentNotes,
                                PaymentProvider = "PayPal",
                                PaymentRef = PaymentReferenceHelper.Compose(request.PayPalOrderId, captureId),
                                CurrencyCode = draft.CurrencyCode,
                                Subtotal = draft.Subtotal,
                                Shipping = draft.Shipping,
                                TaxVat = draft.Tax,
                                DiscountTotal = draft.Discount,
                                GrandTotal = draft.GrandTotal,
                        };

                        foreach (var item in draft.Items)
                        {
                                order.Items.Add(new OrderItem
                                {
                                        JewelryItemId = item.JewelryItemId,
                                        NameSnapshot = item.Name,
                                        UnitPrice = item.UnitPrice,
                                        Quantity = item.Quantity,
                                        LineTotal = item.LineTotal
                                });
                        }

                        _dbContext.Orders.Add(order);

                        var itemsToRemove = draft.Cart.Items.ToList();
                        if (itemsToRemove.Count > 0)
                        {
                                _dbContext.CartItems.RemoveRange(itemsToRemove);
                                draft.Cart.Items.Clear();
                        }

                        await _dbContext.SaveChangesAsync(cancellationToken);
                        await transaction.CommitAsync(cancellationToken);

                        await SendCheckoutEmailAsync(draft.Cart.User?.Email, order);

                        return new OrderCompletionResult(order, request.PayPalOrderId, captureResponse.Status, captureId);
                }

                private async Task SendCheckoutEmailAsync(string? recipientEmail, Order order)
                {
                        if (string.IsNullOrWhiteSpace(recipientEmail))
                        {
                                return;
                        }

                        try
                        {
                                await EmailService.SendCheckoutNoticeAsync(recipientEmail.Trim(), order);
                        }
                        catch (Exception ex)
                        {
                                _logger.LogError(ex, "Failed to send checkout notice for order {OrderId}.", order.Id);
                        }
                }

                private async Task<OrderDraftData> BuildOrderDraftAsync(int userId, CreateOrderRequestDto request, CancellationToken cancellationToken)
                {
                        var cart = await _dbContext.Carts
                                .Include(c => c.User)
                                .Include(c => c.Items)
                                .ThenInclude(ci => ci.jewelryItem)
                                .FirstOrDefaultAsync(c => c.UserId == userId, cancellationToken);

                        if (cart is null)
                        {
                                throw new InvalidOperationException("Cart not found for user.");
                        }

                        if (!cart.Items.Any())
                        {
                                throw new InvalidOperationException("Cannot create an order from an empty cart.");
                        }

                        decimal subtotal = 0m;
                        decimal shipping = 0m;
                        var snapshots = new List<OrderItemSnapshot>();

                        foreach (var cartItem in cart.Items)
                        {
                                if (cartItem.jewelryItem == null)
                                {
                                        cartItem.jewelryItem = await _dbContext.JewelryItems
                                                .FirstOrDefaultAsync(j => j.Id == cartItem.jewelryItemId, cancellationToken);
                                }

                                var unitPrice = cartItem.priceAtAddTime;
                                var quantity = cartItem.quantity;
                                var lineTotal = unitPrice * quantity;

                                subtotal += lineTotal;
                                shipping = Math.Max(shipping, cartItem.jewelryItem?.ShippingPrice ?? 0m);

                                snapshots.Add(new OrderItemSnapshot(
                                        cartItem.jewelryItemId,
                                        cartItem.jewelryItem?.Name,
                                        unitPrice,
                                        quantity,
                                        lineTotal));
                        }

                        var tax = request.TaxAmount ?? 0m;
                        var discount = request.DiscountAmount ?? 0m;
                        var currencyCode = string.IsNullOrWhiteSpace(request.CurrencyCode)
                                ? "USD"
                                : request.CurrencyCode!.Trim().ToUpperInvariant();

                        var grandTotal = subtotal + shipping + tax - discount;

                        return new OrderDraftData(cart, snapshots, subtotal, shipping, tax, discount, grandTotal, currencyCode);
                }

                private PayPalCreateOrderRequest BuildPayPalRequest(OrderDraftData draft)
                {
                        var (returnUrl, cancelUrl) = ResolvePayPalRedirectUrls();

                        var purchaseUnit = new PayPalPurchaseUnit
                        {
                                Amount = new PayPalAmount
                                {
                                        CurrencyCode = draft.CurrencyCode,
                                        Value = draft.GrandTotal.ToString("F2", CultureInfo.InvariantCulture),
                                        Breakdown = new PayPalAmountBreakdown
                                        {
                                                ItemTotal = PayPalCreateOrderRequest.FormatMoney(draft.CurrencyCode, draft.Subtotal)
                                        }
                                }
                        };

                        if (draft.Shipping > 0)
                        {
                                purchaseUnit.Amount.Breakdown.Shipping = PayPalCreateOrderRequest.FormatMoney(draft.CurrencyCode, draft.Shipping);
                        }

                        if (draft.Tax > 0)
                        {
                                purchaseUnit.Amount.Breakdown.TaxTotal = PayPalCreateOrderRequest.FormatMoney(draft.CurrencyCode, draft.Tax);
                        }

                        if (draft.Discount > 0)
                        {
                                purchaseUnit.Amount.Breakdown.Discount = PayPalCreateOrderRequest.FormatMoney(draft.CurrencyCode, draft.Discount);
                        }

                        foreach (var item in draft.Items)
                        {
                                purchaseUnit.Items.Add(new PayPalItem
                                {
                                        Name = string.IsNullOrWhiteSpace(item.Name) ? $"Item {item.JewelryItemId}" : item.Name!,
                                        Quantity = item.Quantity.ToString(CultureInfo.InvariantCulture),
                                        UnitAmount = PayPalCreateOrderRequest.FormatMoney(draft.CurrencyCode, item.UnitPrice)
                                });
                        }

                        return new PayPalCreateOrderRequest
                        {
                                PurchaseUnits = new List<PayPalPurchaseUnit> { purchaseUnit },
                                ApplicationContext = new PayPalApplicationContext
                                {
                                        ShippingPreference = "NO_SHIPPING",
                                        UserAction = "PAY_NOW",
                                        ReturnUrl = returnUrl,
                                        CancelUrl = cancelUrl
                                }
                        };
                }

                private (string ReturnUrl, string CancelUrl) ResolvePayPalRedirectUrls()
                {
                        var configuredReturn = NormalizeAbsoluteUrl(_payPalOptions.ReturnUrl);
                        var configuredCancel = NormalizeAbsoluteUrl(_payPalOptions.CancelUrl);

                        if (configuredReturn is not null && configuredCancel is not null)
                        {
                                return (configuredReturn, configuredCancel);
                        }

                        var requestOrigin = ResolveRequestOrigin();
                        if (requestOrigin is not null)
                        {
                                var originUri = new Uri(requestOrigin, UriKind.Absolute);
                                var defaultReturn = new Uri(originUri, "/checkout").ToString();
                                var defaultCancel = new Uri(originUri, "/checkout?paypal=cancel").ToString();

                                return (
                                        configuredReturn ?? defaultReturn,
                                        configuredCancel ?? defaultCancel);
                        }

                        throw new InvalidOperationException("PayPal return and cancel URLs must be configured.");
                }

                private static string? NormalizeAbsoluteUrl(string? url)
                {
                        if (string.IsNullOrWhiteSpace(url))
                        {
                                return null;
                        }

                        var trimmed = url.Trim();
                        if (!Uri.TryCreate(trimmed, UriKind.Absolute, out var absoluteUri))
                        {
                                throw new InvalidOperationException("PayPal return and cancel URLs must be absolute URLs.");
                        }

                        return absoluteUri.ToString();
                }

                private string? ResolveRequestOrigin()
                {
                        var context = _httpContextAccessor.HttpContext;
                        if (context is null)
                        {
                                return null;
                        }

                        var originHeader = context.Request.Headers["Origin"].FirstOrDefault();
                        if (!string.IsNullOrWhiteSpace(originHeader) && Uri.TryCreate(originHeader, UriKind.Absolute, out var originUri))
                        {
                                return originUri.ToString();
                        }

                        if (!context.Request.Host.HasValue || string.IsNullOrWhiteSpace(context.Request.Scheme))
                        {
                                return null;
                        }

                        return $"{context.Request.Scheme}://{context.Request.Host}";
                }

                private sealed record OrderDraftData(
                        Cart Cart,
                        IReadOnlyList<OrderItemSnapshot> Items,
                        decimal Subtotal,
                        decimal Shipping,
                        decimal Tax,
                        decimal Discount,
                        decimal GrandTotal,
                        string CurrencyCode);
        }

        public record CheckoutPreparationResult(
                decimal Subtotal,
                decimal Shipping,
                decimal Tax,
                decimal Discount,
                decimal GrandTotal,
                string CurrencyCode,
                IReadOnlyList<OrderItemSnapshot> Items,
                string PayPalOrderId,
                string? PayPalStatus,
                string? PayPalApprovalLink);

        public record OrderCompletionResult(Order Order, string PayPalOrderId, string? PayPalStatus, string? PayPalCaptureId);

        public record OrderItemSnapshot(int JewelryItemId, string? Name, decimal UnitPrice, int Quantity, decimal LineTotal);
}
