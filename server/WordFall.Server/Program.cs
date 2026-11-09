using WordFall.Server;

var builder = WebApplication.CreateBuilder(args);
// The port comes from PORT (as most container hosts set it), else ASPNETCORE_URLS, else 8080.
if (Environment.GetEnvironmentVariable("PORT") is { Length: > 0 } port)
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
else if (string.IsNullOrEmpty(builder.Configuration["ASPNETCORE_URLS"]) && string.IsNullOrEmpty(builder.Configuration["urls"]))
    builder.WebHost.UseUrls("http://0.0.0.0:8080");

var options = builder.Configuration.GetSection("Multiplayer");
var allowedOrigins = options.GetSection("AllowedOrigins").Get<string[]>() ?? [];
uint? fixedSeed = uint.TryParse(options["Seed"], out var seed) ? seed : null;

builder.Services.AddSingleton(_ => Dictionaries.Load(options["DataPath"]));
builder.Services.AddSingleton(services => new Lobby(
    services.GetRequiredService<Dictionaries>(),
    services.GetRequiredService<ILogger<Lobby>>(),
    fixedSeed));

var app = builder.Build();

var dictionaries = app.Services.GetRequiredService<Dictionaries>();
if (!dictionaries.Languages.Any())
    app.Logger.LogWarning("No word lists found: set Multiplayer:DataPath to the folder with words_<lang>.txt");
foreach (var lang in dictionaries.Languages)
    app.Logger.LogInformation("Words ({Lang}): {Count}", lang, dictionaries.For(lang)!.Count);

app.UseWebSockets(new WebSocketOptions { KeepAliveInterval = TimeSpan.FromSeconds(20) });

app.MapGet("/", () => "WordFall multiplayer server. Connect a WebSocket to /ws.");
app.MapGet("/healthz", (Lobby lobby) => Results.Ok(new { status = "ok", matches = lobby.MatchCount }));

app.Map("/ws", async (HttpContext context, Lobby lobby, ILogger<PlayerSession> logger) =>
{
    if (!context.WebSockets.IsWebSocketRequest) return Results.BadRequest("WebSocket only");
    // Only the game's own pages may connect, when the allowed origins are set.
    var origin = context.Request.Headers.Origin.ToString();
    if (allowedOrigins.Length > 0 && !allowedOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase))
        return Results.StatusCode(StatusCodes.Status403Forbidden);

    using var socket = await context.WebSockets.AcceptWebSocketAsync();
    await new PlayerSession(socket, lobby, logger).RunAsync(context.RequestAborted);
    return Results.Empty;
});

app.Run();

/// <summary>For the integration tests (WebApplicationFactory).</summary>
public partial class Program;
