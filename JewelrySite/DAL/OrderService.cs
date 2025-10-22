using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using JewelrySite.BL;
using JewelrySite.DTO;
using JewelrySite.HelperClasses;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace JewelrySite.DAL
{
        public class OrderService
        {
                private readonly JewerlyStoreDBContext _dbContext;
                private readonly string _paypalBaseUrl;
                private readonly string _paypalClientId;
                private readonly string _paypalSecret;
                private readonly string? _paypalBaseUrlKey;
                private readonly string? _paypalClientIdKey;
                private readonly string? _paypalSecretKey;
                private readonly ILogger<OrderService> _logger;

                public OrderService(JewerlyStoreDBContext dbContext, IConfiguration configuration, ILogger<OrderService> logger)
                {
                        _dbContext = dbContext;
                        _logger = logger;

                        var baseUrl = PayPalConfigurationHelper.TryResolveBaseUrl(configuration);
                        var clientId = PayPalConfigurationHelper.TryResolveClientId(configuration);
                        var secret = PayPalConfigurationHelper.TryResolveSecret(configuration);

                        _paypalBaseUrl = baseUrl?.value ?? string.Empty;
                        _paypalClientId = clientId?.value ?? string.Empty;
                        _paypalSecret = secret?.value ?? string.Empty;
                        _paypalBaseUrlKey = baseUrl?.key;
                        _paypalClientIdKey = clientId?.key;
                        _paypalSecretKey = secret?.key;

                        LogPayPalConfigurationSnapshot(configuration);
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

                public async Task<string> GetPayPalAccessTokenAsync(CancellationToken cancellationToken = default)
                {
                        if (string.IsNullOrWhiteSpace(_paypalBaseUrl) || string.IsNullOrWhiteSpace(_paypalClientId) || string.IsNullOrWhiteSpace(_paypalSecret))
                        {
                                _logger.LogError(
                                        "PayPal configuration is incomplete. BaseUrlConfigured={HasBaseUrl}, ClientIdConfigured={HasClientId}, SecretConfigured={HasSecret}",
                                        !string.IsNullOrWhiteSpace(_paypalBaseUrl),
                                        !string.IsNullOrWhiteSpace(_paypalClientId),
                                        !string.IsNullOrWhiteSpace(_paypalSecret));
                                throw new InvalidOperationException("PayPal configuration is missing.");
                        }

                        string accessToken = string.Empty;
                        string url = _paypalBaseUrl.TrimEnd('/') + "/v1/oauth2/token";

                        using (var client = new HttpClient())
                        {
                                _logger.LogInformation("Requesting PayPal access token from {Url} using client id sourced from {ClientIdKey}.", url, _paypalClientIdKey ?? "<unknown>");
                                string credentials64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(_paypalClientId + ":" + _paypalSecret));

                                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials64);

                                var requestMessage = new HttpRequestMessage(HttpMethod.Post, url)
                                {
                                        Content = new StringContent("grant_type=client_credentials", Encoding.UTF8, "application/x-www-form-urlencoded")
                                };

                                var httpResponse = await client.SendAsync(requestMessage, cancellationToken);

                                if (httpResponse.IsSuccessStatusCode)
                                {
                                        var strResponse = await httpResponse.Content.ReadAsStringAsync();
                                        var jsonResponse = JsonNode.Parse(strResponse);
                                        if (jsonResponse != null)
                                        {
                                                accessToken = jsonResponse["access_token"]?.ToString() ?? string.Empty;
                                                if (string.IsNullOrWhiteSpace(accessToken))
                                                {
                                                        _logger.LogWarning("PayPal token response did not contain an access token.");
                                                }
                                                else
                                                {
                                                        _logger.LogInformation("Successfully retrieved PayPal access token (length: {Length}).", accessToken.Length);
                                                }
                                        }
                                        else
                                        {
                                                _logger.LogWarning("Unable to parse PayPal access token response as JSON.");
                                        }
                                }
                                else
                                {
                                        var body = await httpResponse.Content.ReadAsStringAsync();
                                        _logger.LogError(
                                                "PayPal token request failed. StatusCode={StatusCode}, ResponseBody={ResponseBody}",
                                                (int)httpResponse.StatusCode,
                                                body);
                                }
                        }

                        return accessToken;
                }

                private void LogPayPalConfigurationSnapshot(IConfiguration configuration)
                {
                        var configuredValues = new List<string>();

                        foreach (var (key, value) in PayPalConfigurationHelper.EnumerateConfiguredPayPalValues(configuration))
                        {
                                if (string.IsNullOrWhiteSpace(value))
                                {
                                        continue;
                                }

                                if (key.Equals(_paypalSecretKey, StringComparison.OrdinalIgnoreCase))
                                {
                                        configuredValues.Add($"{key}=<masked length {value.Trim().Length}>");
                                }
                                else
                                {
                                        configuredValues.Add($"{key}={value.Trim()}");
                                }
                        }

                        _logger.LogInformation(
                                "PayPal configuration resolved. BaseUrlKey={BaseUrlKey}, ClientIdKey={ClientIdKey}, SecretKey={SecretKey}, ConfiguredValues=[{ConfiguredValues}]",
                                _paypalBaseUrlKey ?? "<missing>",
                                _paypalClientIdKey ?? "<missing>",
                                _paypalSecretKey ?? "<missing>",
                                string.Join(", ", configuredValues));
                }
        }
}
