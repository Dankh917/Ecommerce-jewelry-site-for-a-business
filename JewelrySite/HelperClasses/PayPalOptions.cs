using System.ComponentModel.DataAnnotations;

namespace JewelrySite.HelperClasses
{
        public class PayPalOptions
        {
                [Required]
                public string ClientId { get; set; } = string.Empty;

                [Required]
                public string Secret { get; set; } = string.Empty;

                [Required]
                [Url]
                public string BaseUrl { get; set; } = string.Empty;

                public bool IsConfigured()
                {
                        return !string.IsNullOrWhiteSpace(ClientId)
                               && !string.IsNullOrWhiteSpace(Secret)
                               && !string.IsNullOrWhiteSpace(BaseUrl);
                }
        }
}
