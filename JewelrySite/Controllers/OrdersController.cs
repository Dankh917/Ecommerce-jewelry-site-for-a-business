using JewelrySite.BL;
using JewelrySite.DAL;
using JewelrySite.DTO;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace JewelrySite.Controllers
{
        [Route("api/[controller]")]
        [ApiController]
        [Authorize(Roles = "Customer,Admin")]
        public class OrdersController : ControllerBase
        {
                private readonly OrderService _orderService;

                public OrdersController(OrderService orderService)
                {
                        _orderService = orderService;
                }

                private bool TryResolveAuthorizedUserId(int? requestedUserId, out int userId, out ActionResult? errorResult)
                {
                        errorResult = null;
                        userId = 0;

                        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
                        if (!int.TryParse(userIdClaim, out int authenticatedUserId))
                        {
                                errorResult = Unauthorized();
                                return false;
                        }

                        bool isAdmin = User.IsInRole("Admin");

                        if (requestedUserId.HasValue)
                        {
                                if (!isAdmin && requestedUserId.Value != authenticatedUserId)
                                {
                                        errorResult = Forbid();
                                        return false;
                                }

                                userId = requestedUserId.Value;
                                return true;
                        }

                        userId = authenticatedUserId;
                        return true;
                }

                [HttpGet]
                public async Task<ActionResult<IEnumerable<OrderSummaryDto>>> GetOrders(int? userId)
                {
                        if (!TryResolveAuthorizedUserId(userId, out int resolvedUserId, out ActionResult? error))
                        {
                                return error!;
                        }

                        var orders = await _orderService.GetOrdersForUserAsync(resolvedUserId);
                        var response = orders.Select(order => new OrderSummaryDto
                        {
                                OrderId = order.Id,
                                CreatedAt = order.CreatedAt,
                                Status = order.Status,
                                GrandTotal = order.GrandTotal,
                                CurrencyCode = order.CurrencyCode,
                                ItemCount = order.Items.Sum(item => item.Quantity)
                        });

                        return Ok(response);
                }

                [HttpGet("{orderId:int}")]
                public async Task<ActionResult<OrderDetailDto>> GetOrder(int orderId, int? userId)
                {
                        if (!TryResolveAuthorizedUserId(userId, out int resolvedUserId, out ActionResult? error))
                        {
                                return error!;
                        }

                        var order = await _orderService.GetOrderForUserAsync(resolvedUserId, orderId);
                        if (order is null)
                        {
                                return NotFound();
                        }

                        var response = new OrderDetailDto
                        {
                                OrderId = order.Id,
                                CreatedAt = order.CreatedAt,
                                Status = order.Status,
                                GrandTotal = order.GrandTotal,
                                CurrencyCode = order.CurrencyCode,
                                ItemCount = order.Items.Sum(item => item.Quantity),
                                Subtotal = order.Subtotal,
                                Shipping = order.Shipping,
                                TaxVat = order.TaxVat,
                                DiscountTotal = order.DiscountTotal,
                                FullName = order.FullName,
                                Phone = order.Phone,
                                Country = order.Country,
                                City = order.City,
                                Street = order.Street,
                                PostalCode = order.PostalCode,
                                Notes = order.Notes,
                                Items = order.Items.Select(oi => new OrderConfirmationItemDto
                                {
                                        JewelryItemId = oi.JewelryItemId,
                                        Name = oi.NameSnapshot,
                                        UnitPrice = oi.UnitPrice,
                                        Quantity = oi.Quantity,
                                        LineTotal = oi.LineTotal
                                }).ToList()
                        };

                        return Ok(response);
                }

                [HttpPost]
                public async Task<ActionResult<OrderConfirmationDto>> CreateOrder([FromBody] CreateOrderRequestDto request, int? userId)
                {
                        if (!TryResolveAuthorizedUserId(userId, out int resolvedUserId, out ActionResult? error))
                        {
                                return error!;
                        }

                        if (!ModelState.IsValid)
                        {
                                return ValidationProblem(ModelState);
                        }

                        try
                        {
                                Order order = await _orderService.CreateOrderAsync(resolvedUserId, request);
                                var response = new OrderConfirmationDto
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
                                        Items = order.Items.Select(oi => new OrderConfirmationItemDto
                                        {
                                                JewelryItemId = oi.JewelryItemId,
                                                Name = oi.NameSnapshot,
                                                UnitPrice = oi.UnitPrice,
                                                Quantity = oi.Quantity,
                                                LineTotal = oi.LineTotal
                                        }).ToList()
                                };

                                return CreatedAtAction(nameof(CreateOrder), new { id = response.OrderId }, response);
                        }
                        catch (InvalidOperationException ex)
                        {
                                return BadRequest(ex.Message);
                        }
                }

                [HttpGet("paypal-access-token")]
                public async Task<ActionResult<object>> GetPayPalAccessToken()
                {
                        try
                        {
                                var accessToken = await _orderService.GetPayPalAccessTokenAsync();

                                if (string.IsNullOrWhiteSpace(accessToken))
                                {
                                        return StatusCode(502, "Failed to retrieve PayPal access token.");
                                }

                                return Ok(new { accessToken });
                        }
                        catch (InvalidOperationException ex)
                        {
                                return BadRequest(ex.Message);
                        }
                }
        }
}
