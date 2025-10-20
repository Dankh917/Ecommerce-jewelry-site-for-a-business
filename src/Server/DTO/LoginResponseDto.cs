namespace JewelrySite.DTO
{
	public class LoginResponseDto
	{
		public required string JWTToken { get; set; }
		public required string RefreshToken { get; set; }
	}
}
