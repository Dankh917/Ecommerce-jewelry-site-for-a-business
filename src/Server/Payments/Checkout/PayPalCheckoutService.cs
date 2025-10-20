using System.Globalization;
using System.Linq;
using System.Net.Http.Json;
using JewelrySite.BL;
using JewelrySite.DAL;
using JewelrySite.Options;
using JewelrySite.Payments.PayPal;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace JewelrySite.Payments.Checkout;

internal sealed class PayPalCheckoutService : IPayPalCheckoutService
{
    private readonly IPayPalClient _pp;
    private readonly PayPalOptions _opts;
    private readonly JewerlyStoreDBContext _db;

    public PayPalCheckoutService(IPayPalClient pp, IOptions<PayPalOptions> opts, JewerlyStoreDBContext db)
    {
        _pp = pp;
        _opts = opts.Value;
        _db = db;
    }

    public async Task<CreateOrderResult> CreateOrderForCurrentUserAsync(Guid userId, string? idemKey, CancellationToken ct)
    {
        var user = await _db.Users.SingleAsync(u => u.PublicId == userId, ct);

        var cart = await _db.Carts
            .Include(c => c.Items)
                .ThenInclude(i => i.jewelryItem)
            .SingleAsync(c => c.UserId == user.Id, ct);

        if (cart.Items.Count == 0)
        {
            throw new InvalidOperationException("Cart is empty.");
        }

        var total = cart.Items.Sum(i => Math.Round(i.priceAtAddTime * i.quantity, 2));
        var currency = _opts.Currency;

        var body = new
        {
            intent = "CAPTURE",
            purchase_units = new[]
            {
                new
                {
                    amount = new
                    {
                        currency_code = currency,
                        value = total.ToString("F2", CultureInfo.InvariantCulture)
                    }
                }
            },
            application_context = new
            {
                shipping_preference = "NO_SHIPPING",
                user_action = "PAY_NOW",
                brand_name = "EDTArt"
            }
        };

        using var res = await _pp.PostAsync("v2/checkout/orders", body, idemKey, ct);
        res.EnsureSuccessStatusCode();

        var doc = await res.Content.ReadFromJsonAsync<PayPalOrderResp>(cancellationToken: ct)
                  ?? throw new InvalidOperationException("Invalid create order resp");

        var approve = doc.links.First(l => l.rel == "approve").href;
        return new(doc.id, approve);
    }

    public async Task<CaptureOrderResult> CaptureOrderAsync(Guid userId, string orderId, string? idemKey, CancellationToken ct)
    {
        using var res = await _pp.PostAsync($"v2/checkout/orders/{orderId}/capture", new { }, idemKey, ct);
        res.EnsureSuccessStatusCode();

        var cap = await res.Content.ReadFromJsonAsync<PayPalCaptureResp>(cancellationToken: ct)
                  ?? throw new InvalidOperationException("Invalid capture resp");

        var capture = cap.purchase_units[0].payments.captures[0];
        if (!string.Equals(capture.status, "COMPLETED", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Capture not completed");
        }

        var amount = decimal.Parse(capture.amount.value, CultureInfo.InvariantCulture);
        var currency = capture.amount.currency_code;

        decimal gross = amount;
        decimal? fee = null;
        decimal net = amount;
        if (capture.seller_receivable_breakdown is { } breakdown)
        {
            if (breakdown.gross_amount is { } grossAmount)
            {
                if (!string.Equals(grossAmount.currency_code, currency, StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidOperationException("Gross amount currency mismatch");
                }
                gross = decimal.Parse(grossAmount.value, CultureInfo.InvariantCulture);
            }

            if (breakdown.paypal_fee is { } feeAmount)
            {
                if (!string.Equals(feeAmount.currency_code, currency, StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidOperationException("Fee currency mismatch");
                }
                fee = decimal.Parse(feeAmount.value, CultureInfo.InvariantCulture);
            }

            if (breakdown.net_amount is { } netAmount)
            {
                if (!string.Equals(netAmount.currency_code, currency, StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidOperationException("Net amount currency mismatch");
                }
                net = decimal.Parse(netAmount.value, CultureInfo.InvariantCulture);
            }
        }

        var user = await _db.Users.SingleAsync(u => u.PublicId == userId, ct);
        var cart = await _db.Carts
            .Include(c => c.Items)
                .ThenInclude(i => i.jewelryItem)
            .SingleAsync(c => c.UserId == user.Id, ct);

        var expected = cart.Items.Sum(i => Math.Round(i.priceAtAddTime * i.quantity, 2));
        if (!string.Equals(currency, _opts.Currency, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Currency mismatch");
        }

        if (amount != expected)
        {
            throw new InvalidOperationException("Amount mismatch");
        }

        var order = await _db.Orders.SingleOrDefaultAsync(o => o.PayPalOrderId == orderId, ct);
        if (order is null)
        {
            order = new Order
            {
                UserId = user.Id,
                Status = OrderStatus.Paid,
                CreatedAt = DateTime.UtcNow,
                PaidAt = DateTime.UtcNow,
                Subtotal = expected,
                Shipping = 0m,
                TaxVat = 0m,
                DiscountTotal = 0m,
                GrandTotal = expected,
                CurrencyCode = currency
            };
            _db.Orders.Add(order);
        }

        order.Status = OrderStatus.Paid;
        order.PaidAt = DateTime.UtcNow;
        order.PaymentProvider = "PayPal";
        order.PaymentRef = capture.id;
        order.PayPalOrderId = orderId;
        order.PayPalCaptureId = capture.id;
        order.PayPalPayerEmail = cap.payer?.email_address;
        order.PayPalGrossAmount = gross;
        order.PayPalFeeAmount = fee;
        order.PayPalNetAmount = net;
        order.PayPalCapturedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        return new(orderId, capture.id, amount, currency, order.PayPalPayerEmail ?? string.Empty);
    }

    private sealed record PayPalOrderResp(string id, Link[] links);
    private sealed record Link(string href, string rel, string method);

    private sealed record PayPalCaptureResp(Payer? payer, PurchaseUnit[] purchase_units);
    private sealed record Payer(string? email_address);
    private sealed record PurchaseUnit(Payments payments);
    private sealed record Payments(Capture[] captures);
    private sealed record Capture(string id, string status, Amount amount, SellerReceivableBreakdown? seller_receivable_breakdown);
    private sealed record SellerReceivableBreakdown(Amount? gross_amount, Amount? paypal_fee, Amount? net_amount);
    private sealed record Amount(string currency_code, string value);
}
