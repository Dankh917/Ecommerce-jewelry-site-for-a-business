using JewelrySite.BL;
using JewelrySite.DAL;
using JewelrySite.DTO;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;

namespace JewelrySite.Controllers
{
	[Route("api/[controller]")]
	[ApiController]
	public class AuthController : ControllerBase
	{
		AuthService _service;
		public AuthController(AuthService Authservice) { _service = Authservice; }

		public static User user = new User();

		[HttpPost("register")]
		public async Task<ActionResult<User>> register(UserDto request)
		{
			User user = await _service.RegisterAsync(request);
			if (user == null) { return BadRequest("Such user already exists");}
			return Ok(user);
		}

                [HttpPost("login")]
                public async Task<ActionResult<LoginResponseDto>> Login(LoginDto request)
                {
                        LoginResponseDto tokens = await _service.LoginAsync(request);
                        if (tokens == null) { return BadRequest("Invalid email or password"); }
                        return Ok(tokens);
                }

		[HttpPost("refresh-token")]
		public async Task<ActionResult<LoginResponseDto>> RefreshToken(RefreshTokenDto request)
		{
			var result = await _service.RefreshTokensAsync(request);
			if (result is null|| result.RefreshToken is null) { return Unauthorized("Invalid refresh token"); }

			return Ok(result);
		}

		[Authorize]
		[HttpGet]
		public IActionResult AuthOnly()
		{
			return Ok("You are authenticated and can access this endpoint.");
		}
		
		[Authorize(Roles ="Admin")]
		[HttpGet("Admin-only")]
		public IActionResult AdminOnly()
		{
			return Ok("You are authenticated and can access this endpoint.");
		}
	}
}
