namespace JewelrySite.Payments.Checkout;

public interface IPayPalCheckoutService
{
    Task<CreateOrderResult> CreateOrderForCurrentUserAsync(Guid userId, string? idemKey, CancellationToken ct);
    Task<CaptureOrderResult> CaptureOrderAsync(Guid userId, string orderId, string? idemKey, CancellationToken ct);
}

public sealed record CreateOrderResult(string OrderId, string ApproveUrl);
public sealed record CaptureOrderResult(string OrderId, string CaptureId, decimal Amount, string Currency, string PayerEmail);
