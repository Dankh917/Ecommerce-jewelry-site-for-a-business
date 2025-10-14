using System;

namespace JewelrySite.HelperClasses
{
        public static class PaymentReferenceHelper
        {
                private const char Separator = '|';

                public static string Compose(string orderId, string? captureId)
                {
                        if (string.IsNullOrWhiteSpace(orderId))
                        {
                                throw new ArgumentException("PayPal order id is required to compose a payment reference.", nameof(orderId));
                        }

                        return string.IsNullOrWhiteSpace(captureId)
                                ? string.Concat(orderId.Trim(), Separator)
                                : string.Concat(orderId.Trim(), Separator, captureId.Trim());
                }

                public static (string? OrderId, string? CaptureId) Parse(string? reference)
                {
                        if (string.IsNullOrWhiteSpace(reference))
                        {
                                return (null, null);
                        }

                        var trimmed = reference.Trim();
                        if (trimmed.Length == 0)
                        {
                                return (null, null);
                        }

                        var parts = trimmed.Split(Separator);

                        string? orderId = parts.Length > 0 && !string.IsNullOrWhiteSpace(parts[0])
                                ? parts[0]
                                : null;

                        string? captureId = parts.Length > 1 && !string.IsNullOrWhiteSpace(parts[1])
                                ? parts[1]
                                : null;

                        return (orderId, captureId);
                }
        }
}
