using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

namespace JewelrySite.Controllers
{
        [ApiController]
        [AllowAnonymous]
        [Route("api/[controller]")]
        public class ConfigController : ControllerBase
        {
                private readonly IConfiguration _configuration;

                public ConfigController(IConfiguration configuration)
                {
                        _configuration = configuration;
                }

                [HttpGet("paypal-client-id")]
                public ActionResult<object> GetPayPalClientId()
                {
                        string? clientId = _configuration["PayPal:ClientId"];
                        if (string.IsNullOrWhiteSpace(clientId))
                        {
                                return NotFound("PayPal client id is not configured.");
                        }

                        return Ok(new { clientId });
                }
        }
}
