using Microsoft.EntityFrameworkCore;
using UATSystem.API.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text.Json.Serialization;
using System.Text;
using Microsoft.AspNetCore.Identity;
using UATSystem.API.Models;
using UATSystem.API.Services;

var builder = WebApplication.CreateBuilder(args);

var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtKey = jwtSection["Key"] ?? "DEV_ONLY_SUPER_SECRET_CHANGE_ME_1234567890";
var jwtIssuer = jwtSection["Issuer"] ?? "UATSystem";
var jwtAudience = jwtSection["Audience"] ?? "UATSystem";

builder.Services.AddDbContext<UATDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "Test Management System API",
        Version = "v1"
    });
});

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler =
            ReferenceHandler.IgnoreCycles;
    });

builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactApp", policy =>
        policy.WithOrigins("http://localhost:7777", "http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod());
});

builder.Services.Configure<SmtpSettings>(builder.Configuration.GetSection("Smtp"));
builder.Services.AddMemoryCache();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<UATDbContext>();
    db.Database.Migrate();

    var users = db.Users;
    if (!users.Any())
    {
        var hasher = new PasswordHasher<UserAccount>();
        var seedUsers = new[]
        {
            new UserAccount { Username = "admin@nomail.com", DisplayName = "System Admin", Role = "Admin", IsActive = true },
            new UserAccount { Username = "lead@nomail.com", DisplayName = "Test Lead", Role = "Test Lead", IsActive = true },
            new UserAccount { Username = "tester@nomail.com", DisplayName = "Tester", Role = "Tester", IsActive = true },
            new UserAccount { Username = "viewer@nomail.com", DisplayName = "Viewer", Role = "Viewer", IsActive = true },
            new UserAccount { Username = "developer@nomail.com", DisplayName = "Developer", Role = "Developer", IsActive = true },
        };

        foreach (var user in seedUsers)
        {
            user.PasswordHash = hasher.HashPassword(user, "ChangeMe123!");
            user.CreatedAt = DateTime.UtcNow;
            users.Add(user);
        }

        db.SaveChanges();
    }

}

app.UseSwagger();
app.UseSwaggerUI(options =>
{
    if (app.Environment.IsDevelopment())
    {
        options.SwaggerEndpoint(
            "/swagger/v1/swagger.json",
            "Test Management System API v1");
    }
    else
    {
        options.SwaggerEndpoint(
            "/api/swagger/v1/swagger.json",
            "Test Management System API v1");
    }

    options.RoutePrefix = "swagger";
});

app.UseCors("ReactApp");
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();