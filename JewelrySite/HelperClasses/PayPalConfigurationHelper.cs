using System;
using System.Collections.Generic;
using Microsoft.Extensions.Configuration;

namespace JewelrySite.HelperClasses
{
        public static class PayPalConfigurationHelper
        {
                private static readonly string[] BaseUrlKeys =
                {
                        "PayPal:BaseUrl",
                        "PayPal:BaseURL",
                        "PayPal:Endpoint",
                        "PayPal:ApiBaseUrl",
                        "PayPal:ApiBaseURL",
                        "PayPalBaseUrl",
                        "PayPalBaseURL",
                        "PayPal__BaseUrl",
                        "PayPal__BaseURL",
                        "PAYPAL_BASE_URL",
                        "PAYPAL__BASEURL",
                        "PAYPAL__BASE_URL"
                };

                private static readonly string[] ClientIdKeys =
                {
                        "PayPal:ClientId",
                        "PayPal:ClientID",
                        "PayPal:Client_Id",
                        "PayPalClientId",
                        "PayPalClientID",
                        "PayPal__ClientId",
                        "PayPal__ClientID",
                        "PAYPAL_CLIENT_ID",
                        "PAYPAL__CLIENTID",
                        "PAYPAL__CLIENT_ID"
                };

                private static readonly string[] SecretKeys =
                {
                        "PayPal:Secret",
                        "PayPal:ClientSecret",
                        "PayPal:Client_Secret",
                        "PayPalSecret",
                        "PayPalClientSecret",
                        "PayPal__Secret",
                        "PayPal__ClientSecret",
                        "PAYPAL_SECRET",
                        "PAYPAL_CLIENT_SECRET",
                        "PAYPAL__SECRET",
                        "PAYPAL__CLIENTSECRET"
                };

                public static (string value, string key)? TryResolveBaseUrl(IConfiguration configuration)
                {
                        return TryResolveSetting(configuration, BaseUrlKeys, NormalizeUrl);
                }

                public static (string value, string key)? TryResolveClientId(IConfiguration configuration)
                {
                        return TryResolveSetting(configuration, ClientIdKeys, TrimValue);
                }

                public static (string value, string key)? TryResolveSecret(IConfiguration configuration)
                {
                        return TryResolveSetting(configuration, SecretKeys, TrimValue);
                }

                public static IEnumerable<(string key, string? value)> EnumerateConfiguredPayPalValues(IConfiguration configuration)
                {
                        foreach (var key in BaseUrlKeys)
                        {
                                yield return (key, configuration[key]);
                        }

                        foreach (var key in ClientIdKeys)
                        {
                                yield return (key, configuration[key]);
                        }

                        foreach (var key in SecretKeys)
                        {
                                yield return (key, configuration[key]);
                        }
                }

                private static (string value, string key)? TryResolveSetting(IConfiguration configuration, IReadOnlyList<string> candidateKeys, Func<string, string> normalizeValue)
                {
                        foreach (var key in candidateKeys)
                        {
                                var value = configuration[key];
                                if (!string.IsNullOrWhiteSpace(value))
                                {
                                        return (normalizeValue(value), key);
                                }
                        }

                        return null;
                }

                private static string TrimValue(string value)
                {
                        return value.Trim();
                }

                private static string NormalizeUrl(string value)
                {
                        return value.Trim().TrimEnd('/');
                }
        }
}
