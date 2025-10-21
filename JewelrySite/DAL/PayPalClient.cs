using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using JewelrySite.HelperClasses;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace JewelrySite.DAL
{
        public class PayPalClient
        {
                private readonly IHttpClientFactory _httpClientFactory;
                private readonly ILogger<PayPalClient> _logger;
                private readonly PayPalOptions _options;
                private readonly JsonSerializerOptions _serializerOptions = new()
                {
                        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
                };

                public PayPalClient(
                        IHttpClientFactory httpClientFactory,
                        IOptions<PayPalOptions> optionsAccessor,
                        IConfiguration configuration,
                        ILogger<PayPalClient> logger)
                {
                        _httpClientFactory = httpClientFactory;
                        _logger = logger;
                        _options = optionsAccessor.Value ?? new PayPalOptions();

                        _options.ClientId ??= configuration["PAYPAL_CLIENT_ID"];
                        _options.Secret ??= configuration["PAYPAL_CLIENT_SECRET"];
                        _options.Environment = string.IsNullOrWhiteSpace(_options.Environment)
                                ? configuration["PAYPAL_ENVIRONMENT"] ?? "sandbox"
                                : _options.Environment;
                        _options.BaseUrl ??= configuration["PAYPAL_BASE_URL"];
                        _options.Currency = string.IsNullOrWhiteSpace(_options.Currency)
                                ? configuration["PAYPAL_CURRENCY_CODE"] ?? "USD"
                                : _options.Currency;
                }

                public string CurrencyCode => _options.Currency;

                public async Task<PayPalApiResponse> CreateOrderAsync(object orderPayload, CancellationToken cancellationToken)
                {
                        var accessToken = await GetAccessTokenAsync(cancellationToken);
                        using var request = new HttpRequestMessage(HttpMethod.Post, "v2/checkout/orders");
                        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
                        request.Headers.Add("Prefer", "return=representation");
                        request.Content = new StringContent(JsonSerializer.Serialize(orderPayload, _serializerOptions), Encoding.UTF8, "application/json");

                        return await SendAsync(request, cancellationToken);
                }

                public async Task<PayPalApiResponse> CaptureOrderAsync(string orderId, CancellationToken cancellationToken)
                {
                        var accessToken = await GetAccessTokenAsync(cancellationToken);
                        using var request = new HttpRequestMessage(HttpMethod.Post, $"v2/checkout/orders/{orderId}/capture");
                        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
                        request.Headers.Add("Prefer", "return=representation");

                        return await SendAsync(request, cancellationToken);
                }

                private async Task<PayPalApiResponse> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
                {
                        var client = _httpClientFactory.CreateClient();
                        client.BaseAddress = new Uri(_options.ResolveBaseUrl());

                        using var response = await client.SendAsync(request, cancellationToken);
                        var content = await response.Content.ReadAsStringAsync(cancellationToken);

                        JsonDocument? body = null;
                        if (!string.IsNullOrWhiteSpace(content))
                        {
                                try
                                {
                                        body = JsonDocument.Parse(content);
                                }
                                catch (JsonException ex)
                                {
                                        _logger.LogError(ex, "Failed to parse PayPal response JSON: {Content}", content);
                                }
                        }

                        return new PayPalApiResponse(response.StatusCode, body, content);
                }

                private async Task<string> GetAccessTokenAsync(CancellationToken cancellationToken)
                {
                        if (string.IsNullOrWhiteSpace(_options.ClientId) || string.IsNullOrWhiteSpace(_options.Secret))
                        {
                                throw new InvalidOperationException("PayPal credentials are not configured. Provide PayPal:ClientId and PayPal:Secret values or set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables.");
                        }

                        var client = _httpClientFactory.CreateClient();
                        client.BaseAddress = new Uri(_options.ResolveBaseUrl());

                        using var request = new HttpRequestMessage(HttpMethod.Post, "v1/oauth2/token");
                        var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_options.ClientId}:{_options.Secret}"));
                        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", credentials);
                        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
                        request.Content = new FormUrlEncodedContent(new[]
                        {
                                new KeyValuePair<string?, string?>("grant_type", "client_credentials"),
                        });

                        using var response = await client.SendAsync(request, cancellationToken);
                        var content = await response.Content.ReadAsStringAsync(cancellationToken);

                        if (!response.IsSuccessStatusCode)
                        {
                                _logger.LogError(
                                        "Failed to obtain PayPal access token. Status: {Status}. Response: {Response}",
                                        response.StatusCode,
                                        content);
                                throw new InvalidOperationException("Failed to authenticate with PayPal.");
                        }

                        try
                        {
                                var token = JsonSerializer.Deserialize<PayPalTokenResponse>(content, _serializerOptions);
                                if (token?.AccessToken is null)
                                {
                                        throw new InvalidOperationException("PayPal response did not include an access token.");
                                }

                                return token.AccessToken;
                        }
                        catch (JsonException ex)
                        {
                                _logger.LogError(ex, "Failed to deserialize PayPal token response: {Response}", content);
                                throw new InvalidOperationException("Unable to parse PayPal authentication response.", ex);
                        }
                }

                private sealed record PayPalTokenResponse
                {
                        public string? AccessToken { get; init; }
                }
        }

        public record PayPalApiResponse(System.Net.HttpStatusCode StatusCode, JsonDocument? Body, string RawContent)
        {
                public object ToActionResultPayload()
                {
                        if (Body is null)
                        {
                                return string.IsNullOrWhiteSpace(RawContent)
                                        ? new { }
                                        : new { raw = RawContent };
                        }

                        return JsonSerializer.Deserialize<object>(Body.RootElement.GetRawText()) ?? new { };
                }
        }
}
