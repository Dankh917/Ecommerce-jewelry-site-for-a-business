using JewelrySite.BL;

public class PasswordResetRequest
{
	public int Id { get; set; }
	public int UserId { get; set; }

	// Store only the hash of the random token
	public string TokenHash { get; set; } = default!;
	public DateTime ExpiresAtUtc { get; set; }
	public DateTime CreatedAtUtc { get; set; }
	public DateTime? UsedAtUtc { get; set; }
	
}
