using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using JewelrySite.BL;
using JewelrySite.DTO;
using JewelrySite.HelperClasses;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace JewelrySite.DAL
{
        public class OrderService
        {
                private readonly JewerlyStoreDBContext _dbContext;
                private readonly PayPalClient _payPalClient;
                private readonly ILogger<OrderService> _logger;

                public OrderService(JewerlyStoreDBContext dbContext, PayPalClient payPalClient, ILogger<OrderService> logger)
                {
                        _dbContext = dbContext;
                        _payPalClient = payPalClient;
                        _logger = logger;
                }

                public async Task<OrderCreationResult> CreateOrderAsync(int userId, CreateOrderRequestDto request, CancellationToken cancellationToken = default)
                {
                        await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

                        try
                        {
                                var cart = await _dbContext.Carts
                                        .Include(c => c.User)
                                        .Include(c => c.Items)
                                        .ThenInclude(ci => ci.jewelryItem)
                                        .FirstOrDefaultAsync(c => c.UserId == userId, cancellationToken);

                                if (cart == null)
                                {
                                        throw new InvalidOperationException("Cart not found for user.");
                                }

                                if (!cart.Items.Any())
                                {
                                        throw new InvalidOperationException("Cannot create an order from an empty cart.");
                                }

                                decimal subtotal = 0m;
                                decimal shipping = 0m;
                                decimal tax = 0m;
                                decimal discount = 0m;

                                var order = new Order
                                {
                                        UserId = userId,
                                        Status = OrderStatus.Pending,
                                        CreatedAt = DateTime.UtcNow,
                                        FullName = request.FullName,
                                        Phone = request.Phone,
                                        Country = request.Country,
                                        City = request.City,
                                        Street = request.Street,
                                        PostalCode = request.PostalCode,
                                        Notes = request.PaymentNotes,
                                        PaymentProvider = "PayPal",
                                        PaymentRef = null,
                                        CurrencyCode = string.IsNullOrWhiteSpace(request.CurrencyCode) ? "USD" : request.CurrencyCode!
                                };

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

                                        order.Items.Add(new OrderItem
                                        {
                                                JewelryItemId = cartItem.jewelryItemId,
                                                NameSnapshot = cartItem.jewelryItem?.Name,
                                                UnitPrice = unitPrice,
                                                Quantity = quantity,
                                                LineTotal = lineTotal
                                        });
                                }

                                // Future extension hooks
                                tax = request.TaxAmount ?? tax;
                                discount = request.DiscountAmount ?? discount;

                                order.Subtotal = subtotal;
                                order.Shipping = shipping;
                                order.TaxVat = tax;
                                order.DiscountTotal = discount;
                                order.GrandTotal = subtotal + shipping + tax - discount;

                                var paypalRequest = BuildPayPalRequest(order);
                                var paypalResponse = await _payPalClient.CreateOrderAsync(paypalRequest, cancellationToken);

                                order.PaymentRef = PaymentReferenceHelper.Compose(paypalResponse.Id, null);

                                _dbContext.Orders.Add(order);

                                // remove cart items to mark checkout completion
                                var itemsToRemove = cart.Items.ToList();
                                _dbContext.CartItems.RemoveRange(itemsToRemove);
                                cart.Items.Clear();

                                await _dbContext.SaveChangesAsync(cancellationToken);
                                await transaction.CommitAsync(cancellationToken);

                                var recipientEmail = cart.User?.Email?.Trim();
                                if (!string.IsNullOrWhiteSpace(recipientEmail))
                                {
                                        try
                                        {
                                                await EmailService.SendCheckoutNoticeAsync(recipientEmail, order);
                                        }
                                        catch (Exception ex)
                                        {
                                                Console.Error.WriteLine($"Failed to send checkout notice for order {order.Id}: {ex.Message}");
                                        }
                                }

                                return new OrderCreationResult(order, paypalResponse.Id, paypalResponse.Status, paypalResponse.GetApprovalLink());
                        }
                        catch
                        {
                                await transaction.RollbackAsync(cancellationToken);
                                throw;
                        }
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

                public async Task<OrderCaptureResult?> CaptureOrderAsync(int userId, int orderId, string payPalOrderId, CancellationToken cancellationToken = default)
                {
                        if (string.IsNullOrWhiteSpace(payPalOrderId))
                        {
                                throw new ArgumentException("PayPal order id is required for capture.", nameof(payPalOrderId));
                        }

                        var order = await _dbContext.Orders
                                .Include(o => o.Items)
                                .FirstOrDefaultAsync(o => o.Id == orderId && o.UserId == userId, cancellationToken);

                        if (order is null)
                        {
                                _logger.LogWarning("Attempt to capture PayPal order for missing orderId {OrderId} and userId {UserId}.", orderId, userId);
                                return null;
                        }

                        var (storedOrderId, existingCaptureId) = PaymentReferenceHelper.Parse(order.PaymentRef);
                        if (!string.Equals(storedOrderId, payPalOrderId, StringComparison.Ordinal))
                        {
                                throw new InvalidOperationException("PayPal order id does not match the stored payment reference.");
                        }

                        if (order.Status == OrderStatus.Paid)
                        {
                                return new OrderCaptureResult(order, payPalOrderId, "COMPLETED", existingCaptureId);
                        }

                        var captureResponse = await _payPalClient.CaptureOrderAsync(payPalOrderId, cancellationToken);
                        var captureId = captureResponse.GetCaptureId();

                        if (!string.IsNullOrWhiteSpace(captureId))
                        {
                                order.PaymentRef = PaymentReferenceHelper.Compose(payPalOrderId, captureId);
                        }

                        if (string.Equals(captureResponse.Status, "COMPLETED", StringComparison.OrdinalIgnoreCase))
                        {
                                order.Status = OrderStatus.Paid;
                                order.PaidAt = DateTime.UtcNow;
                        }

                        await _dbContext.SaveChangesAsync(cancellationToken);

                        return new OrderCaptureResult(order, payPalOrderId, captureResponse.Status, captureId);
                }

                private static PayPalCreateOrderRequest BuildPayPalRequest(Order order)
                {
                        var purchaseUnit = new PayPalPurchaseUnit
                        {
                                Amount = new PayPalAmount
                                {
                                        CurrencyCode = order.CurrencyCode,
                                        Value = order.GrandTotal.ToString("F2", CultureInfo.InvariantCulture),
                                        Breakdown = new PayPalAmountBreakdown
                                        {
                                                ItemTotal = PayPalCreateOrderRequest.FormatMoney(order.CurrencyCode, order.Subtotal)
                                        }
                                }
                        };

                        if (order.Shipping > 0)
                        {
                                purchaseUnit.Amount.Breakdown.Shipping = PayPalCreateOrderRequest.FormatMoney(order.CurrencyCode, order.Shipping);
                        }

                        if (order.TaxVat > 0)
                        {
                                purchaseUnit.Amount.Breakdown.TaxTotal = PayPalCreateOrderRequest.FormatMoney(order.CurrencyCode, order.TaxVat);
                        }

                        if (order.DiscountTotal > 0)
                        {
                                purchaseUnit.Amount.Breakdown.Discount = PayPalCreateOrderRequest.FormatMoney(order.CurrencyCode, order.DiscountTotal);
                        }

                        foreach (var item in order.Items)
                        {
                                purchaseUnit.Items.Add(new PayPalItem
                                {
                                        Name = string.IsNullOrWhiteSpace(item.NameSnapshot) ? $"Item {item.JewelryItemId}" : item.NameSnapshot!,
                                        Quantity = item.Quantity.ToString(CultureInfo.InvariantCulture),
                                        UnitAmount = PayPalCreateOrderRequest.FormatMoney(order.CurrencyCode, item.UnitPrice)
                                });
                        }

                        return new PayPalCreateOrderRequest
                        {
                                PurchaseUnits = new List<PayPalPurchaseUnit> { purchaseUnit },
                                ApplicationContext = new PayPalApplicationContext
                                {
                                        ShippingPreference = "NO_SHIPPING",
                                        UserAction = "PAY_NOW"
                                }
                        };
                }
        }

        public record OrderCreationResult(Order Order, string PayPalOrderId, string? PayPalStatus, string? ApprovalLink);

        public record OrderCaptureResult(Order Order, string PayPalOrderId, string? PayPalStatus, string? PayPalCaptureId);
}
