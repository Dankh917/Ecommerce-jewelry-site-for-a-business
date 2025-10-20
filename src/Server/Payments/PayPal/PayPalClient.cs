using System.Net.Http.Headers;
using System.Net.Http.Json;
using JewelrySite.Options;
using Microsoft.Extensions.Options;

namespace JewelrySite.Payments.PayPal;

internal sealed class PayPalClient : IPayPalClient
{
    private readonly HttpClient _http;
    private readonly PayPalOptions _opts;
    private string? _token;
    private DateTimeOffset _tokenExp;

    public PayPalClient(HttpClient http, IOptions<PayPalOptions> options)
    {
        _http = http;
        _opts = options.Value;
        _http.BaseAddress = new Uri(_opts.BaseUrl.TrimEnd('/') + "/");
    }

    public async Task<string> GetAccessTokenAsync(CancellationToken ct)
    {
        if (_token is not null && DateTimeOffset.UtcNow < _tokenExp)
        {
            return _token;
        }

        using var req = new HttpRequestMessage(HttpMethod.Post, "v1/oauth2/token")
        {
            Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "client_credentials"
            })
        };

        var basic = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes($"{_opts.ClientId}:{_opts.Secret}"));
        req.Headers.Authorization = new AuthenticationHeaderValue("Basic", basic);

        using var res = await _http.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
        var doc = await res.Content.ReadFromJsonAsync<OAuthResp>(cancellationToken: ct)
                  ?? throw new InvalidOperationException("No token");
        _token = doc.access_token;
        _tokenExp = DateTimeOffset.UtcNow.AddSeconds(Math.Max(30, doc.expires_in - 60));
        return _token!;
    }

    public async Task<HttpResponseMessage> PostAsync(string path, object body, string? idempotencyKey, CancellationToken ct)
    {
        var token = await GetAccessTokenAsync(ct);
        using var req = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = JsonContent.Create(body)
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (!string.IsNullOrWhiteSpace(idempotencyKey))
        {
            req.Headers.TryAddWithoutValidation("PayPal-Request-Id", idempotencyKey);
        }

        return await _http.SendAsync(req, ct);
    }

    public async Task<HttpResponseMessage> GetAsync(string path, CancellationToken ct)
    {
        var token = await GetAccessTokenAsync(ct);
        using var req = new HttpRequestMessage(HttpMethod.Get, path);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await _http.SendAsync(req, ct);
    }

    private sealed record OAuthResp(string scope, string access_token, string token_type, int expires_in);
}
