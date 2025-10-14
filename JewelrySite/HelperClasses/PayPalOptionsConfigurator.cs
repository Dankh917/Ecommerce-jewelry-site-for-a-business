using System;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace JewelrySite.HelperClasses
{
        public sealed class PayPalOptionsConfigurator : IConfigureOptions<PayPalOptions>
        {
                private readonly ILogger<PayPalOptionsConfigurator> _logger;

                public PayPalOptionsConfigurator(ILogger<PayPalOptionsConfigurator> logger)
                {
                        _logger = logger;
                }

                public void Configure(PayPalOptions options)
                {
                        if (options is null)
                        {
                                throw new ArgumentNullException(nameof(options));
                        }

                        NormalizeFromEnvironment(options);
                        PopulateReturnAndCancelUrlsFromBase(options);
                }

                private void NormalizeFromEnvironment(PayPalOptions options)
                {
                        options.ClientId = GetNormalizedValue(options.ClientId, "PAYPAL_CLIENT_ID", nameof(options.ClientId));
                        options.Secret = GetNormalizedValue(options.Secret, "PAYPAL_SECRET", nameof(options.Secret));
                        options.BaseUrl = GetNormalizedValue(options.BaseUrl, "PAYPAL_BASE_URL", nameof(options.BaseUrl));
                        options.ReturnUrl = GetNormalizedValue(options.ReturnUrl, "PAYPAL_RETURN_URL", nameof(options.ReturnUrl));
                        options.CancelUrl = GetNormalizedValue(options.CancelUrl, "PAYPAL_CANCEL_URL", nameof(options.CancelUrl));
                }

                private string GetNormalizedValue(string currentValue, string environmentVariable, string optionName)
                {
                        if (!string.IsNullOrWhiteSpace(currentValue))
                        {
                                return currentValue.Trim();
                        }

                        var environmentValue = Environment.GetEnvironmentVariable(environmentVariable);
                        if (string.IsNullOrWhiteSpace(environmentValue))
                        {
                                return currentValue;
                        }

                        var normalized = environmentValue.Trim();
                        _logger.LogInformation(
                                "PayPal option {OptionName} loaded from environment variable {EnvironmentVariable}.",
                                optionName,
                                environmentVariable);
                        return normalized;
                }

                private void PopulateReturnAndCancelUrlsFromBase(PayPalOptions options)
                {
                        if (!string.IsNullOrWhiteSpace(options.ReturnUrl) && !string.IsNullOrWhiteSpace(options.CancelUrl))
                        {
                                return;
                        }

                        var appBaseUrl = Environment.GetEnvironmentVariable("APP_BASE_URL");
                        if (string.IsNullOrWhiteSpace(appBaseUrl))
                        {
                                return;
                        }

                        var normalizedBase = appBaseUrl.Trim().TrimEnd('/');
                        if (string.IsNullOrWhiteSpace(options.ReturnUrl))
                        {
                                options.ReturnUrl = $"{normalizedBase}/paypal/return";
                                _logger.LogInformation(
                                        "PayPal return URL defaulted to {ReturnUrl} using APP_BASE_URL.",
                                        options.ReturnUrl);
                        }

                        if (string.IsNullOrWhiteSpace(options.CancelUrl))
                        {
                                options.CancelUrl = $"{normalizedBase}/paypal/cancel";
                                _logger.LogInformation(
                                        "PayPal cancel URL defaulted to {CancelUrl} using APP_BASE_URL.",
                                        options.CancelUrl);
                        }
                }
        }
}
