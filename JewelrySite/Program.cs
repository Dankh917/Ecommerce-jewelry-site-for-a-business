using JewelrySite.DAL;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;

namespace JewelrySite
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

			builder.Services.AddCors(options =>
			{
				options.AddPolicy("AllowReactApp",
					policy =>
					{
						policy.WithOrigins("http://localhost:51600") // your React dev server
							  .AllowAnyHeader()
							  .AllowAnyMethod();
					});
			});



			builder.Services.AddControllers();
            // Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
            builder.Services.AddOpenApi();

            builder.Services.AddDbContext<JewerlyStoreDBContext>(options => options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnectionDB")));

			builder.Services.AddScoped<CartService>();
			builder.Services.AddScoped<JewelryItemService>();
			builder.Services.AddScoped<AuthService>();
			EmailService.Init(builder.Configuration);


			builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
				.AddJwtBearer(options =>
				{
					options.TokenValidationParameters = new TokenValidationParameters
					{
						ValidateIssuer = true,
						ValidateAudience = true,
						ValidateLifetime = true,
						ValidateIssuerSigningKey = true,
						ValidIssuer = builder.Configuration["Issuer"],
						ValidAudience = builder.Configuration["Audience"],
						IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Token"]!))
					};
				});

			var app = builder.Build();

			app.UseCors("AllowReactApp");

			// Configure the HTTP request pipeline.
			if (app.Environment.IsDevelopment())
            {
                app.MapOpenApi();
                app.UseSwaggerUI(options => options.SwaggerEndpoint("/openapi/v1.json", "Jewel api")); //add to config file
			}

            app.UseHttpsRedirection();

			app.UseAuthentication();
			app.UseAuthorization();


            app.MapControllers();

            app.Run();
        }
    }
}
