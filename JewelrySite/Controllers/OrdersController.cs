using JewelrySite.BL;
using JewelrySite.DAL;
using JewelrySite.DTO;
using JewelrySite.HelperClasses;
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

                        var confirmation = BuildOrderConfirmation(order);
                        var response = new OrderDetailDto
                        {
                                OrderId = confirmation.OrderId,
                                CreatedAt = confirmation.CreatedAt,
                                Status = confirmation.Status,
                                GrandTotal = confirmation.GrandTotal,
                                CurrencyCode = confirmation.CurrencyCode,
                                ItemCount = order.Items.Sum(item => item.Quantity),
                                Subtotal = confirmation.Subtotal,
                                Shipping = confirmation.Shipping,
                                TaxVat = confirmation.TaxVat,
                                DiscountTotal = confirmation.DiscountTotal,
                                FullName = order.FullName,
                                Phone = order.Phone,
                                Country = order.Country,
                                City = order.City,
                                Street = order.Street,
                                PostalCode = order.PostalCode,
                                Notes = order.Notes,
                                Items = confirmation.Items,
                                PaymentProvider = confirmation.PaymentProvider,
                                PaymentReference = confirmation.PaymentReference,
                                PayPalOrderId = confirmation.PayPalOrderId,
                                PayPalCaptureId = confirmation.PayPalCaptureId,
                                PayPalStatus = confirmation.PayPalStatus
                        };

                        return Ok(response);
                }

                [HttpPost]
                public async Task<ActionResult<CheckoutPreparationDto>> CreateOrder([FromBody] CreateOrderRequestDto request, int? userId)
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
                                CheckoutPreparationResult result = await _orderService.PrepareCheckoutAsync(resolvedUserId, request);
                                var response = new CheckoutPreparationDto
                                {
                                        Subtotal = result.Subtotal,
                                        Shipping = result.Shipping,
                                        TaxVat = result.Tax,
                                        DiscountTotal = result.Discount,
                                        GrandTotal = result.GrandTotal,
                                        CurrencyCode = result.CurrencyCode,
                                        PayPalClientId = result.PayPalClientId,
                                        PayPalOrderId = result.PayPalOrderId,
                                        PayPalApprovalUrl = result.PayPalApprovalLink,
                                        PayPalStatus = result.PayPalStatus,
                                        RequiresPayment = result.RequiresPayment,
                                        Items = result.Items.Select(item => new OrderConfirmationItemDto
                                        {
                                                JewelryItemId = item.JewelryItemId,
                                                Name = item.Name,
                                                UnitPrice = item.UnitPrice,
                                                Quantity = item.Quantity,
                                                LineTotal = item.LineTotal
                                        })
                                };

                                if (!result.RequiresPayment && result.Order is not null)
                                {
                                        response.Order = BuildOrderConfirmation(result.Order);
                                }

                                return Ok(response);
                        }
                        catch (InvalidOperationException ex)
                        {
                                return BadRequest(ex.Message);
                        }
                }

                [HttpPost("complete")]
                public async Task<ActionResult<OrderConfirmationDto>> CompleteOrder([FromBody] CompleteOrderRequestDto request, int? userId)
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
                                var completionResult = await _orderService.CompleteOrderAsync(resolvedUserId, request);
                                var response = BuildOrderConfirmation(completionResult.Order, completionResult.PayPalOrderId, completionResult.PayPalStatus, null, completionResult.PayPalCaptureId);
                                return Ok(response);
                        }
                        catch (InvalidOperationException ex)
                        {
                                return BadRequest(ex.Message);
                        }
                }

                private static OrderConfirmationDto BuildOrderConfirmation(Order order, string? payPalOrderIdOverride = null, string? payPalStatusOverride = null, string? approvalUrl = null, string? captureIdOverride = null)
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

