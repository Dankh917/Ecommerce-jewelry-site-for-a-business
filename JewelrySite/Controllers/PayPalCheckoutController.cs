using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using JewelrySite.BL;
using JewelrySite.DAL;
using JewelrySite.DTO;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace JewelrySite.Controllers
{
        [ApiController]
        [Route("api/paypal")]
        [Authorize(Roles = "Customer,Admin")]
        public class PayPalCheckoutController : ControllerBase
        {
                private readonly CartService _cartService;
                private readonly PayPalClient _payPalClient;
                private readonly ILogger<PayPalCheckoutController> _logger;

                public PayPalCheckoutController(CartService cartService, PayPalClient payPalClient, ILogger<PayPalCheckoutController> logger)
                {
                        _cartService = cartService;
                        _payPalClient = payPalClient;
                        _logger = logger;
                }

                [HttpPost("orders")]
                public async Task<IActionResult> CreateOrder([FromBody] PayPalCreateOrderRequestDto request, CancellationToken cancellationToken)
                {
                        if (!TryGetAuthenticatedUserId(out var userId, out var errorResult))
                        {
                                return errorResult!;
                        }

                        Cart cart;
                        try
                        {
                                cart = await _cartService.GetOrCreateCartByUserId(userId);
                        }
                        catch (InvalidOperationException ex)
                        {
                                _logger.LogWarning(ex, "Unable to resolve cart for user {UserId}", userId);
                                return BadRequest(new { error = "Unable to locate cart for the current user." });
                        }

                        if (cart.Items.Count == 0)
                        {
                                return BadRequest(new { error = "Your cart is empty." });
                        }

                        var requestedItemIds = ParseRequestedItemIds(request);
                        var relevantItems = cart.Items
                                .Where(item => requestedItemIds.Count == 0 || requestedItemIds.Contains(item.Id))
                                .ToList();

                        if (relevantItems.Count == 0)
                        {
                                return BadRequest(new { error = "The provided cart selection does not match any items." });
                        }

                        var orderItems = new List<object>(relevantItems.Count);
                        decimal subtotal = 0m;
                        decimal shipping = 0m;

                        foreach (var item in relevantItems)
                        {
                                var quantity = item.quantity;
                                var unitAmount = item.priceAtAddTime;
                                subtotal += unitAmount * quantity;

                                var shippingPrice = item.jewelryItem?.ShippingPrice ?? 0m;
                                if (shippingPrice > shipping)
                                {
                                        shipping = shippingPrice;
                                }

                                var description = Truncate(item.jewelryItem?.Description, 127);
                                var name = Truncate(item.jewelryItem?.Name ?? $"Item #{item.jewelryItemId}", 127);

                                orderItems.Add(new
                                {
                                        name,
                                        quantity = quantity.ToString(CultureInfo.InvariantCulture),
                                        description,
                                        sku = item.jewelryItemId.ToString(CultureInfo.InvariantCulture),
                                        category = "PHYSICAL_GOODS",
                                        unit_amount = new
                                        {
                                                currency_code = _payPalClient.CurrencyCode,
                                                value = FormatAmount(unitAmount),
                                        },
                                });
                        }

                        var total = subtotal + shipping;

                        var orderPayload = new
                        {
                                intent = "CAPTURE",
                                purchase_units = new[]
                                {
                                        new
                                        {
                                                amount = new
                                                {
                                                        currency_code = _payPalClient.CurrencyCode,
                                                        value = FormatAmount(total),
                                                        breakdown = new
                                                        {
                                                                item_total = new
                                                                {
                                                                        currency_code = _payPalClient.CurrencyCode,
                                                                        value = FormatAmount(subtotal),
                                                                },
                                                                shipping = new
                                                                {
                                                                        currency_code = _payPalClient.CurrencyCode,
                                                                        value = FormatAmount(shipping),
                                                                },
                                                        },
                                                },
                                                items = orderItems,
                                                custom_id = $"cart-{cart.Id}",
                                        },
                                },
                        };

                        try
                        {
                                var response = await _payPalClient.CreateOrderAsync(orderPayload, cancellationToken);
                                return StatusCode((int)response.StatusCode, response.ToActionResultPayload());
                        }
                        catch (InvalidOperationException ex)
                        {
                                _logger.LogError(ex, "Failed to create PayPal order for user {UserId}", userId);
                                return StatusCode(500, new { error = ex.Message });
                        }
                }

                [HttpPost("orders/{orderId}/capture")]
                public async Task<IActionResult> CaptureOrder(string orderId, CancellationToken cancellationToken)
                {
                        if (!TryGetAuthenticatedUserId(out _, out var errorResult))
                        {
                                return errorResult!;
                        }

                        if (string.IsNullOrWhiteSpace(orderId))
                        {
                                return BadRequest(new { error = "A PayPal order ID is required." });
                        }

                        try
                        {
                                var response = await _payPalClient.CaptureOrderAsync(orderId, cancellationToken);
                                return StatusCode((int)response.StatusCode, response.ToActionResultPayload());
                        }
                        catch (InvalidOperationException ex)
                        {
                                _logger.LogError(ex, "Failed to capture PayPal order {OrderId}", orderId);
                                return StatusCode(500, new { error = ex.Message });
                        }
                }

                private bool TryGetAuthenticatedUserId(out int userId, out IActionResult? errorResult)
                {
                        errorResult = null;
                        userId = 0;
                        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
                        if (!int.TryParse(userIdClaim, NumberStyles.Integer, CultureInfo.InvariantCulture, out userId))
                        {
                                errorResult = Unauthorized();
                                return false;
                        }

                        return true;
                }

                private static HashSet<int> ParseRequestedItemIds(PayPalCreateOrderRequestDto? request)
                {
                        var set = new HashSet<int>();
                        if (request?.Cart is null)
                        {
                                return set;
                        }

                        foreach (var entry in request.Cart)
                        {
                                if (string.IsNullOrWhiteSpace(entry.Id))
                                {
                                        continue;
                                }

                                if (int.TryParse(entry.Id, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed))
                                {
                                        set.Add(parsed);
                                }
                        }

                        return set;
                }

                private static string FormatAmount(decimal amount)
                {
                        return Math.Round(amount, 2, MidpointRounding.AwayFromZero).ToString("0.00", CultureInfo.InvariantCulture);
                }

                private static string? Truncate(string? value, int maxLength)
                {
                        if (string.IsNullOrWhiteSpace(value))
                        {
                                return null;
                        }

                        return value.Length <= maxLength ? value : value.Substring(0, maxLength);
                }
        }
}
