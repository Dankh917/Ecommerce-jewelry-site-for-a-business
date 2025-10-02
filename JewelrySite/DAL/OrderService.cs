using System;
using JewelrySite.BL;
using JewelrySite.DTO;
using Microsoft.EntityFrameworkCore;

namespace JewelrySite.DAL
{
        public class OrderService
        {
                private readonly JewerlyStoreDBContext _dbContext;

                public OrderService(JewerlyStoreDBContext dbContext)
                {
                        _dbContext = dbContext;
                }

                public async Task<Order> CreateOrderAsync(int userId, CreateOrderRequestDto request, CancellationToken cancellationToken = default)
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
                                        PaymentProvider = request.PaymentMethod,
                                        PaymentRef = request.PaymentReference,
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

                                return order;
                        }
                        catch
                        {
                                await transaction.RollbackAsync(cancellationToken);
                                throw;
                        }
                }
        }
}
