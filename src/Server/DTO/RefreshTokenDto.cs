namespace JewelrySite.DTO
{
	public class RefreshTokenDto
	{
		public int UserId { get; set; }
		public required string RefreshToken { get; set; }
	}
}
