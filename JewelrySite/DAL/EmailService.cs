using JewelrySite.BL;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using MimeKit;
using System.Net.Mail;
using System.Threading.Tasks;

public static class EmailService
{
	private static string Email;
	private static string AppPassword;

	public static void Init(IConfiguration config)
	{
		Email = config["Gmail:Email"];
		AppPassword = config["Gmail:Password"];
	}

	public static async Task SendAsync(string to, string subject, string htmlBody)
	{
		try
		{
			var message = new MimeMessage();
			message.From.Add(new MailboxAddress("EDTArt", Email));
			message.To.Add(MailboxAddress.Parse(to));
			message.Subject = subject;

			var bodyBuilder = new BodyBuilder { HtmlBody = htmlBody };
			message.Body = bodyBuilder.ToMessageBody();

			using var client = new MailKit.Net.Smtp.SmtpClient();
			await client.ConnectAsync("smtp.gmail.com", 587, SecureSocketOptions.StartTls);
			await client.AuthenticateAsync(Email, AppPassword);
			await client.SendAsync(message);
			await client.DisconnectAsync(true);
		}
		catch (Exception ex)
		{
			
			throw new InvalidOperationException("Failed to send email.", ex);
		}
	}
}
