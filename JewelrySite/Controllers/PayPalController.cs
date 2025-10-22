using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using JewelrySite.DAL;
using JewelrySite.DTO;
using JewelrySite.HelperClasses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace JewelrySite.Controllers
{
        [Route("api/[controller]")]
        [ApiController]
        [Authorize(Roles = "Customer,Admin")]
        public class PayPalController : ControllerBase
        {
                private readonly OrderService _orderService;

                public PayPalController(OrderService orderService)
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

                [HttpPost("create-order")]
                public async Task<ActionResult<CheckoutPreparationDto>> CreatePayPalOrder([FromBody] CreateOrderRequestDto request, int? userId)
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
                                var result = await _orderService.PrepareCheckoutAsync(resolvedUserId, request);
                                var response = new CheckoutPreparationDto
                                {
                                        Subtotal = result.Subtotal,
                                        Shipping = result.Shipping,
                                        TaxVat = result.Tax,
                                        DiscountTotal = result.Discount,
                                        GrandTotal = result.GrandTotal,
                                        CurrencyCode = result.CurrencyCode,
                                        PayPalOrderId = result.PayPalOrderId,
                                        PayPalApprovalUrl = result.PayPalApprovalLink,
                                        PayPalStatus = result.PayPalStatus,
                                        Items = result.Items.Select(item => new OrderConfirmationItemDto
                                        {
                                                JewelryItemId = item.JewelryItemId,
                                                Name = item.Name,
                                                UnitPrice = item.UnitPrice,
                                                Quantity = item.Quantity,
                                                LineTotal = item.LineTotal
                                        })
                                };

                                return Ok(response);
                        }
                        catch (InvalidOperationException ex)
                        {
                                return BadRequest(ex.Message);
                        }
                }

                [HttpPost("capture-order")]
                public async Task<ActionResult<OrderConfirmationDto>> CapturePayPalOrder([FromBody] CompleteOrderRequestDto request, int? userId)
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
                                var response = OrderResponseFactory.BuildOrderConfirmation(
                                        completionResult.Order,
                                        completionResult.PayPalOrderId,
                                        completionResult.PayPalStatus,
                                        null,
                                        completionResult.PayPalCaptureId);

                                return Ok(response);
                        }
                        catch (InvalidOperationException ex)
                        {
                                return BadRequest(ex.Message);
                        }
                }
        }
}
