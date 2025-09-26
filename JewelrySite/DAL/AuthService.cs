using Azure.Core;
using JewelrySite.BL;
using JewelrySite.DTO;
using JewelrySite.HelperClasses;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.UI.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
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

	

		public async Task<LoginResponseDto?> LoginAsync(LoginDto request)
                {
                        User user = _db.Users.FirstOrDefault(u => u.Email == request.Email);

                        if (user == null) { return null; }

                        if (new PasswordHasher<User>().VerifyHashedPassword(user, user.PasswordHash, request.Password) == PasswordVerificationResult.Failed)
                        {
                                return null;
                        }

                        LoginResponseDto response = await CreateTokenResponse(user);

                        return response;
                }

		private async Task<LoginResponseDto> CreateTokenResponse(User user)
		{
			return new LoginResponseDto
			{
				JWTToken = CreateJWTToken(user),
				RefreshToken = await CreateAndSaveRefreshToken(user)
			};
		}


		public async Task<User?> RegisterAsync(UserDto request)
		{
			if (await _db.Users.AnyAsync(u => u.Username == request.Username)) {
				return null; //cannot register with that name  since we have someone with that name 
			}
			
			User user = new User();
			
			string hashedPassword = new PasswordHasher<User>()
				.HashPassword(user, request.Password);

			user.Username = request.Username;
			user.Email = request.Email;
			user.PasswordHash = hashedPassword;

			_db.Users.Add(user);
			await _db.SaveChangesAsync();

			return user;
		}


		private string CreateJWTToken(User user)
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
				expires: DateTime.UtcNow.AddMinutes(15),
				signingCredentials: creds
				);

			return new JwtSecurityTokenHandler().WriteToken(tokenDescriptor);
		}

		private string CreateRefreshToken()
		{
			byte[] randomNumber = new byte[32];
			using RandomNumberGenerator rng = RandomNumberGenerator.Create();
			
			rng.GetBytes(randomNumber);
			return Convert.ToBase64String(randomNumber);
		}

		private async Task<string> CreateAndSaveRefreshToken(User user)
		{
			string refreshToken = CreateRefreshToken();


			string hashedRefreshToken = new PasswordHasher<User>()
				.HashPassword(user, refreshToken);

			user.RefreshToken = hashedRefreshToken;
			user.RefreshTokenExpirationDate = DateTime.UtcNow.AddDays(7);
			_db.Users.Update(user);
			await _db.SaveChangesAsync();
			return refreshToken;
		}


		public async Task<User?> ValidateRefreshToken(int userID, string refreshToken)
		{
			User user = await _db.Users.FindAsync(userID);

			if (user is null|| user.RefreshTokenExpirationDate < DateTime.UtcNow) { return null; }

			PasswordHasher<User> hasher = new PasswordHasher<User>();
			PasswordVerificationResult result = hasher.VerifyHashedPassword(user, user.RefreshToken, refreshToken);

			if (result == PasswordVerificationResult.Failed) {return null;}
				
			return user;
		}

		public async Task<LoginResponseDto?> RefreshTokensAsync(RefreshTokenDto request) { 
			
			var user = await ValidateRefreshToken(request.UserId, request.RefreshToken);

			if (user is null) { return null; }
			 
			return await CreateTokenResponse(user);
		}

		
		public async Task<string> ForgotPassword(string email)
		{
			if (string.IsNullOrWhiteSpace(email))
			{
				throw new ArgumentException("Email is required , request failed", nameof(email));
			}
				

			var normalizedEmail = email.Trim().ToLowerInvariant();

			// Try to find the user (normalize to avoid case mismatches)
			var user = await _db.Users.SingleOrDefaultAsync(u => u.Email.Trim().ToLower() == normalizedEmail);

			// Add a tiny delay so attackers can't measure timing
			await Task.Delay(Random.Shared.Next(50, 150));

			if (user != null)
			{
				var now = DateTime.UtcNow;

				// Check if user already has an active reset token
				var hasActiveToken = await _db.PasswordResetRequests
					.AnyAsync(r => r.UserId == user.Id && r.UsedAtUtc == null && r.ExpiresAtUtc > now);

				if (!hasActiveToken)
				{
					// Generate secure random token
					var tokenBytes = RandomNumberGenerator.GetBytes(32); // 256-bit
					var token = WebEncoders.Base64UrlEncode(tokenBytes);

					// Store only the hash in the DB
					using var sha = SHA256.Create();
					var tokenHash = Convert.ToHexString(sha.ComputeHash(Encoding.UTF8.GetBytes(token)));

					var reset = new PasswordResetRequest
					{
						UserId = user.Id,
						TokenHash = tokenHash,
						CreatedAtUtc = now,
						ExpiresAtUtc = now.AddMinutes(30)
					};

					_db.PasswordResetRequests.Add(reset);
					await _db.SaveChangesAsync();

					// Build reset link (frontend route)
					string baseUrl = _configuration.GetValue<string>("Frontend:BaseUrl") ?? throw new InvalidOperationException("Frontend:BaseUrl is not configured."); 
					var resetUrl = $"{baseUrl}/reset-password?token={token}";

					// Send email
					await EmailService.SendAsync(
						to: user.Email,
						subject: "Reset your EDTArt password",
						
						htmlBody: $"""
						<p>We received a request to reset your password.</p>
						<p><a href="{resetUrl}">Reset Password</a> (valid for 30 minutes)</p>
						<p>If you didn’t request this, you can safely ignore this email.</p>
						"""

					);
				}
			}

			return "we sent an email with a password reset link";
		}


		public async Task ResetPasswordAsync(string token, string newPassword)
		{
			if (string.IsNullOrWhiteSpace(token))
				throw new ArgumentException("Token is required.", nameof(token));
			if (string.IsNullOrWhiteSpace(newPassword))
				throw new ArgumentException("New password is required.", nameof(newPassword));

			if (!PasswordPolicy.IsValid(newPassword))
				throw new InvalidOperationException("Password does not meet requirements.");

			// Hash the opaque token to match stored hash
			using var sha = SHA256.Create();
			var tokenHash = Convert.ToHexString(sha.ComputeHash(Encoding.UTF8.GetBytes(token)));
			var now = DateTime.UtcNow;

			// Find reset request by hash
			var reset = await _db.PasswordResetRequests
				.SingleOrDefaultAsync(r => r.TokenHash == tokenHash);

			if (reset is null || reset.UsedAtUtc != null || reset.ExpiresAtUtc < now)
				throw new UnauthorizedAccessException("Invalid or expired reset token.");

			// Get user by FK
			var user = await _db.Users.FindAsync(reset.UserId);
			if (user is null)
				throw new KeyNotFoundException("User not found for reset token.");

			// Wrap in transaction so both updates happen atomically
			await using var tx = await _db.Database.BeginTransactionAsync();
			try
			{
				// Hash new password (same way as registration)
				string hashedPassword = new PasswordHasher<User>()
					.HashPassword(user, newPassword);

				user.PasswordHash = hashedPassword;

				// Mark reset token as consumed
				reset.UsedAtUtc = now;

				await _db.SaveChangesAsync();
				await tx.CommitAsync();
			}
			catch
			{
				await tx.RollbackAsync();
				throw;
			}
		}



	}
}
