using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace JewelrySite.Extensions;

public static class ClaimsPrincipalExtensions
{
    public static Guid GetUserId(this ClaimsPrincipal principal)
    {
        var sub = principal.FindFirstValue(JwtRegisteredClaimNames.Sub)
                  ?? principal.FindFirstValue("sub");
        if (sub is not null && Guid.TryParse(sub, out var guid))
        {
            return guid;
        }

        var fallback = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (fallback is not null && Guid.TryParse(fallback, out var fallbackGuid))
        {
            return fallbackGuid;
        }

        throw new InvalidOperationException("Authenticated user id is missing or invalid.");
    }
}
