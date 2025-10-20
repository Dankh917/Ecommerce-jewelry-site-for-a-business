using JewelrySite.Extensions;
using JewelrySite.Payments.Checkout;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace JewelrySite.Controllers;

[ApiController]
[Route("api/checkout/paypal")]
public class CheckoutController : ControllerBase
{
    private readonly IPayPalCheckoutService _svc;

    public CheckoutController(IPayPalCheckoutService svc) => _svc = svc;

    [HttpPost("order")]
    [Authorize]
    public async Task<IActionResult> CreateOrder([FromHeader(Name = "Idempotency-Key")] string? idemKey, CancellationToken ct)
    {
        var userId = User.GetUserId();
        var result = await _svc.CreateOrderForCurrentUserAsync(userId, idemKey, ct);
        return Ok(result);
    }

    public sealed record CaptureReq(string OrderId);

    [HttpPost("capture")]
    [Authorize]
    public async Task<IActionResult> Capture([FromBody] CaptureReq req, [FromHeader(Name = "Idempotency-Key")] string? idemKey, CancellationToken ct)
    {
        var userId = User.GetUserId();
        var result = await _svc.CaptureOrderAsync(userId, req.OrderId, idemKey, ct);
        return Ok(result);
    }
}
