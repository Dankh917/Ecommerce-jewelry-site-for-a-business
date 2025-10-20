namespace JewelrySite.Options;

public sealed class PayPalOptions
{
    public string ClientId { get; init; } = "";
    public string Secret { get; init; } = "";
    public string BaseUrl { get; init; } = "https://api-m.paypal.com";
    public string Currency { get; init; } = "USD";
    public string? WebhookId { get; init; }
}
