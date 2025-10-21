using System;

namespace JewelrySite.HelperClasses
{
        public class PayPalOptions
        {
                public string? ClientId { get; set; }

                public string? Secret { get; set; }

                public string Environment { get; set; } = "sandbox";

                public string? BaseUrl { get; set; }

                public string Currency { get; set; } = "USD";

                public string ResolveBaseUrl()
                {
                        if (!string.IsNullOrWhiteSpace(BaseUrl))
                        {
                                return BaseUrl!;
                        }

                        return string.Equals(Environment, "live", StringComparison.OrdinalIgnoreCase)
                                ? "https://api-m.paypal.com/"
                                : "https://api-m.sandbox.paypal.com/";
                }
        }
}
