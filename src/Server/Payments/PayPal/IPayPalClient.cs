using System.Net.Http;

namespace JewelrySite.Payments.PayPal;

public interface IPayPalClient
{
    Task<string> GetAccessTokenAsync(CancellationToken ct);
    Task<HttpResponseMessage> PostAsync(string path, object body, string? idempotencyKey, CancellationToken ct);
    Task<HttpResponseMessage> GetAsync(string path, CancellationToken ct);
}
