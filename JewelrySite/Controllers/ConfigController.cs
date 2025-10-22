using System;
using System.Collections.Generic;
using JewelrySite.HelperClasses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace JewelrySite.Controllers
{
        [ApiController]
        [AllowAnonymous]
        [Route("api/[controller]")]
        public class ConfigController : ControllerBase
        {
                private readonly IConfiguration _configuration;
                private readonly ILogger<ConfigController> _logger;

                public ConfigController(IConfiguration configuration, ILogger<ConfigController> logger)
                {
                        _configuration = configuration;
                        _logger = logger;
                }

                [HttpGet("paypal-client-id")]
                public ActionResult<object> GetPayPalClientId()
                {
                        var baseUrlResult = PayPalConfigurationHelper.TryResolveBaseUrl(_configuration);
                        var clientIdResult = PayPalConfigurationHelper.TryResolveClientId(_configuration);
                        var secretResult = PayPalConfigurationHelper.TryResolveSecret(_configuration);

                        string? clientId = clientIdResult?.value;
                        string? baseUrl = baseUrlResult?.value;

                        var formattedValues = BuildFormattedConfigurationValues(secretResult?.key);

                        LogConfigurationSnapshot(baseUrlResult?.key, clientIdResult?.key, secretResult?.key, formattedValues);

                        if (string.IsNullOrWhiteSpace(clientId))
                        {
                                _logger.LogWarning("PayPal client id is not configured. Checked keys: {Keys}", string.Join(", ", formattedValues));
                                return NotFound("PayPal client id is not configured.");
                        }

                        if (string.IsNullOrWhiteSpace(baseUrl))
                        {
                                _logger.LogWarning("PayPal base url is not configured. Checked keys: {Keys}", string.Join(", ", formattedValues));
                                return NotFound("PayPal base url is not configured.");
                        }

                        _logger.LogInformation(
                                "Returning PayPal configuration. BaseUrlKey={BaseUrlKey}, ClientIdKey={ClientIdKey}, SecretKey={SecretKey}, BaseUrl={BaseUrl}, ClientIdLength={ClientIdLength}",
                                baseUrlResult?.key ?? "<missing>",
                                clientIdResult?.key ?? "<missing>",
                                secretResult?.key ?? "<missing>",
                                baseUrl,
                                clientId.Length);

                        return Ok(new { clientId, baseUrl });
                }

                private void LogConfigurationSnapshot(string? baseUrlKey, string? clientIdKey, string? secretKey, IReadOnlyList<string> formattedValues)
                {
                        _logger.LogInformation(
                                "PayPal configuration snapshot for request. BaseUrlKey={BaseUrlKey}, ClientIdKey={ClientIdKey}, SecretKey={SecretKey}, ConfiguredValues=[{ConfiguredValues}]",
                                baseUrlKey ?? "<missing>",
                                clientIdKey ?? "<missing>",
                                secretKey ?? "<missing>",
                                string.Join(", ", formattedValues));
                }

                private List<string> BuildFormattedConfigurationValues(string? secretKey)
                {
                        var configuredValues = new List<string>();

                        foreach (var (key, value) in PayPalConfigurationHelper.EnumerateConfiguredPayPalValues(_configuration))
                        {
                                if (string.IsNullOrWhiteSpace(value))
                                {
                                        continue;
                                }

                                if (!string.IsNullOrEmpty(secretKey) && key.Equals(secretKey, StringComparison.OrdinalIgnoreCase))
                                {
                                        configuredValues.Add($"{key}=<masked length {value.Trim().Length}>");
                                }
                                else
                                {
                                        configuredValues.Add($"{key}={value.Trim()}");
                                }
                        }

                        return configuredValues;
                }
        }
}
