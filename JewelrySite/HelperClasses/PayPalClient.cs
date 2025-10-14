using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace JewelrySite.HelperClasses
{
        public class PayPalClient
        {
                private readonly IHttpClientFactory _httpClientFactory;
                private readonly PayPalOptions _options;
                private readonly ILogger<PayPalClient> _logger;
                private readonly JsonSerializerOptions _serializerOptions = new(JsonSerializerDefaults.Web);

                public PayPalClient(IHttpClientFactory httpClientFactory, IOptions<PayPalOptions> options, ILogger<PayPalClient> logger)
                {
                        _httpClientFactory = httpClientFactory;
                        _logger = logger;
                        _options = options.Value;
                }

                public async Task<PayPalCreateOrderResponse> CreateOrderAsync(PayPalCreateOrderRequest request, CancellationToken cancellationToken = default)
                {
                        EnsureConfigured();

                        var accessToken = await GetAccessTokenAsync(cancellationToken);
                        var client = CreateBaseClient(accessToken);

                        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, "/v2/checkout/orders")
                        {
                                Content = JsonContent.Create(request, options: _serializerOptions)
                        };
                        httpRequest.Headers.Add("Prefer", "return=representation");

                        var response = await client.SendAsync(httpRequest, cancellationToken);

                        if (!response.IsSuccessStatusCode)
                        {
                                var errorMessage = await SafeReadAsync(response, cancellationToken);
                                _logger.LogError("PayPal create order failed with status {Status}: {Error}", response.StatusCode, errorMessage);
                                throw new InvalidOperationException("Failed to create PayPal order.");
                        }

                        var payload = await response.Content.ReadFromJsonAsync<PayPalCreateOrderResponse>(_serializerOptions, cancellationToken);
                        if (payload is null || string.IsNullOrWhiteSpace(payload.Id))
                        {
                                throw new InvalidOperationException("PayPal did not return a valid order id.");
                        }

                        return payload;
                }

                public async Task<PayPalCaptureOrderResponse> CaptureOrderAsync(string orderId, CancellationToken cancellationToken = default)
                {
                        if (string.IsNullOrWhiteSpace(orderId))
                        {
                                throw new ArgumentException("PayPal order id is required.", nameof(orderId));
                        }

                        EnsureConfigured();

                        var accessToken = await GetAccessTokenAsync(cancellationToken);
                        var client = CreateBaseClient(accessToken);

                        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, $"/v2/checkout/orders/{orderId}/capture");
                        httpRequest.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

                        var response = await client.SendAsync(httpRequest, cancellationToken);

                        if (!response.IsSuccessStatusCode)
                        {
                                var errorMessage = await SafeReadAsync(response, cancellationToken);
                                _logger.LogError("PayPal capture order failed for {OrderId} with status {Status}: {Error}", orderId, response.StatusCode, errorMessage);
                                throw new InvalidOperationException("Failed to capture PayPal order.");
                        }

                        var payload = await response.Content.ReadFromJsonAsync<PayPalCaptureOrderResponse>(_serializerOptions, cancellationToken);
                        if (payload is null || string.IsNullOrWhiteSpace(payload.Id))
                        {
                                throw new InvalidOperationException("PayPal did not return a valid capture response.");
                        }

                        return payload;
                }

                private void EnsureConfigured()
                {
                        if (!_options.IsConfigured())
                        {
                                throw new InvalidOperationException("PayPal credentials are not configured.");
                        }
                }

                private async Task<string> GetAccessTokenAsync(CancellationToken cancellationToken)
                {
                        var client = _httpClientFactory.CreateClient("PayPal");

                        using var request = new HttpRequestMessage(HttpMethod.Post, "/v1/oauth2/token");
                        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", BuildBasicAuthHeader());
                        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
                        request.Content = new FormUrlEncodedContent(new Dictionary<string, string>
                        {
                                { "grant_type", "client_credentials" }
                        });

                        var response = await client.SendAsync(request, cancellationToken);
                        if (!response.IsSuccessStatusCode)
                        {
                                var error = await SafeReadAsync(response, cancellationToken);
                                _logger.LogError("PayPal token request failed with status {Status}: {Error}", response.StatusCode, error);
                                throw new InvalidOperationException("Unable to authenticate with PayPal.");
                        }

                        var payload = await response.Content.ReadFromJsonAsync<PayPalTokenResponse>(_serializerOptions, cancellationToken);
                        if (payload?.AccessToken is null)
                        {
                                throw new InvalidOperationException("PayPal did not return an access token.");
                        }

                        return payload.AccessToken;
                }

                private HttpClient CreateBaseClient(string accessToken)
                {
                        var client = _httpClientFactory.CreateClient("PayPal");
                        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                        client.DefaultRequestHeaders.Accept.Clear();
                        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
                        return client;
                }

                private string BuildBasicAuthHeader()
                {
                        var raw = string.Concat(_options.ClientId.Trim(), ':', _options.Secret.Trim());
                        return Convert.ToBase64String(Encoding.UTF8.GetBytes(raw));
                }

                private static async Task<string> SafeReadAsync(HttpResponseMessage response, CancellationToken cancellationToken)
                {
                        try
                        {
                                return await response.Content.ReadAsStringAsync(cancellationToken);
                        }
                        catch
                        {
                                return string.Empty;
                        }
                }
        }

        public sealed class PayPalCreateOrderRequest
        {
                [JsonPropertyName("intent")]
                public string Intent { get; set; } = "CAPTURE";

                [JsonPropertyName("purchase_units")]
                public List<PayPalPurchaseUnit> PurchaseUnits { get; set; } = new();

                [JsonPropertyName("application_context")]
                public PayPalApplicationContext ApplicationContext { get; set; } = new();

                public static PayPalMoney FormatMoney(string currencyCode, decimal value)
                {
                        return new PayPalMoney
                        {
                                CurrencyCode = currencyCode,
                                Value = value.ToString("F2", CultureInfo.InvariantCulture)
                        };
                }
        }

        public sealed class PayPalApplicationContext
        {
                [JsonPropertyName("shipping_preference")]
                public string ShippingPreference { get; set; } = "NO_SHIPPING";

                [JsonPropertyName("user_action")]
                public string UserAction { get; set; } = "PAY_NOW";

                [JsonPropertyName("return_url")]
                public string ReturnUrl { get; set; } = string.Empty;

                [JsonPropertyName("cancel_url")]
                public string CancelUrl { get; set; } = string.Empty;
        }

        public sealed class PayPalPurchaseUnit
        {
                [JsonPropertyName("amount")]
                public PayPalAmount Amount { get; set; } = new();

                [JsonPropertyName("items")]
                public List<PayPalItem> Items { get; set; } = new();
        }

        public sealed class PayPalItem
        {
                [JsonPropertyName("name")]
                public string Name { get; set; } = string.Empty;

                [JsonPropertyName("quantity")]
                public string Quantity { get; set; } = "1";

                [JsonPropertyName("unit_amount")]
                public PayPalMoney UnitAmount { get; set; } = new();
        }

        public sealed class PayPalAmount
        {
                [JsonPropertyName("currency_code")]
                public string CurrencyCode { get; set; } = "USD";

                [JsonPropertyName("value")]
                public string Value { get; set; } = "0.00";

                [JsonPropertyName("breakdown")]
                public PayPalAmountBreakdown Breakdown { get; set; } = new();
        }

        public sealed class PayPalAmountBreakdown
        {
                [JsonPropertyName("item_total")]
                public PayPalMoney ItemTotal { get; set; } = new();

                [JsonPropertyName("shipping")]
                [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
                public PayPalMoney? Shipping { get; set; }

                [JsonPropertyName("tax_total")]
                [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
                public PayPalMoney? TaxTotal { get; set; }

                [JsonPropertyName("discount")]
                [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
                public PayPalMoney? Discount { get; set; }
        }

        public sealed class PayPalMoney
        {
                [JsonPropertyName("currency_code")]
                public string CurrencyCode { get; set; } = "USD";

                [JsonPropertyName("value")]
                public string Value { get; set; } = "0.00";
        }

        public sealed class PayPalLinkDescription
        {
                [JsonPropertyName("href")]
                public string? Href { get; set; }

                [JsonPropertyName("rel")]
                public string? Rel { get; set; }

                [JsonPropertyName("method")]
                public string? Method { get; set; }
        }

        public sealed class PayPalCreateOrderResponse
        {
                [JsonPropertyName("id")]
                public string Id { get; set; } = string.Empty;

                [JsonPropertyName("status")]
                public string? Status { get; set; }

                [JsonPropertyName("links")]
                public List<PayPalLinkDescription> Links { get; set; } = new();

                public string? GetApprovalLink()
                {
                        return Links.FirstOrDefault(l => string.Equals(l.Rel, "approve", StringComparison.OrdinalIgnoreCase))?.Href;
                }
        }

        public sealed class PayPalCaptureOrderResponse
        {
                [JsonPropertyName("id")]
                public string Id { get; set; } = string.Empty;

                [JsonPropertyName("status")]
                public string? Status { get; set; }

                [JsonPropertyName("purchase_units")]
                public List<PayPalCapturePurchaseUnit> PurchaseUnits { get; set; } = new();

                public string? GetCaptureId()
                {
                        return PurchaseUnits
                                .SelectMany(pu => pu.Payments?.Captures ?? Enumerable.Empty<PayPalCaptureDetail>())
                                .Select(c => c.Id)
                                .FirstOrDefault(id => !string.IsNullOrWhiteSpace(id));
                }
        }

        public sealed class PayPalCapturePurchaseUnit
        {
                [JsonPropertyName("payments")]
                public PayPalCapturePayments? Payments { get; set; }
        }

        public sealed class PayPalCapturePayments
        {
                [JsonPropertyName("captures")]
                public List<PayPalCaptureDetail> Captures { get; set; } = new();
        }

        public sealed class PayPalCaptureDetail
        {
                [JsonPropertyName("id")]
                public string Id { get; set; } = string.Empty;

                [JsonPropertyName("status")]
                public string? Status { get; set; }
        }

        public sealed class PayPalTokenResponse
        {
                [JsonPropertyName("access_token")]
                public string? AccessToken { get; set; }
        }
}
