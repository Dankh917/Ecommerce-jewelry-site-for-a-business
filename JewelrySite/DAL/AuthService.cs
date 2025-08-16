using JewelrySite.BL;
using JewelrySite.DTO;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace JewelrySite.DAL
{
	public class AuthService
	{

		IConfiguration _configuration;
		JewerlyStoreDBContext _db;

		public AuthService(IConfiguration configuration, JewerlyStoreDBContext db)
		{
			this._configuration = configuration;
			_db = db;
		}

		public async Task<string?> LoginAsync(UserDto request)
		{
			User user =  _db.Users.FirstOrDefault(u => u.Username == request.Username);
			
			if (user == null) { return null; }
			
			if (new PasswordHasher<User>().VerifyHashedPassword(user, user.PasswordHash, request.Password) == PasswordVerificationResult.Failed)
			{
				return null;
			}

			return CreateToken(user);
			
		}
		public async Task<User?> RegisterAsync(UserDto request)
		{
			if (await _db.Users.AnyAsync(u => u.Username == request.Username)) {
				return null; //cannot register with that name  since we have someone with that name 
			}
			
			User user = new User();
			
			string hashedPassword = new PasswordHasher<User >()
				.HashPassword(user, request.Password);

			user.Username = request.Username;
			user.Email = request.Email;
			user.PasswordHash = hashedPassword;

			_db.Users.Add(user);
			await _db.SaveChangesAsync();

			return user;
		}


		private string CreateToken(User user)
		{
			var claims = new List<Claim>
			{
				new Claim(ClaimTypes.Name,user.Username),
				new Claim(ClaimTypes.NameIdentifier,user.Id.ToString()),
				new Claim(ClaimTypes.Role, user.Role)
			};

			var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration.GetValue<string>("Token")!));

			var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha512);

			var tokenDescriptor = new JwtSecurityToken(
				issuer: _configuration.GetValue<string>("Issuer"),
				audience: _configuration.GetValue<string>("Audience"),
				claims: claims,
				expires: DateTime.UtcNow.AddDays(1),
				signingCredentials: creds
				);

			return new JwtSecurityTokenHandler().WriteToken(tokenDescriptor);
		}
	}
}
