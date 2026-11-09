using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using WordFall.Server;

namespace WordFall.Server.Tests;

/// <summary>Two players over real WebSockets, against the server in memory.</summary>
public sealed class MultiplayerTests : IDisposable
{
    private const uint Seed = 987654321;
    private readonly string dataPath = Directory.CreateTempSubdirectory("wordfall-").FullName;
    private readonly WebApplicationFactory<Program> factory;
    private readonly int[] seqs;
    private readonly string word;

    public MultiplayerTests()
    {
        // A word list holding just the word the round's first three letters spell.
        var tiles = MatchStateTests.TilesOf(Seed, "en", MatchStateTests.IsLetter).Take(3).ToList();
        seqs = tiles.Select(t => t.Seq).ToArray();
        word = string.Concat(tiles.Select(t => t.Spec.Letter)).ToLowerInvariant();
        File.WriteAllText(Path.Combine(dataPath, "words_en.txt"), word + "\n");
        factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Multiplayer:DataPath", dataPath);
            builder.UseSetting("Multiplayer:Seed", Seed.ToString());
        });
    }

    public void Dispose()
    {
        factory.Dispose();
        Directory.Delete(dataPath, true);
    }

    private async Task<WebSocket> Connect()
    {
        var client = factory.Server.CreateWebSocketClient();
        return await client.ConnectAsync(new Uri(factory.Server.BaseAddress, "ws"), CancellationToken.None);
    }

    private static Task Send(WebSocket socket, object message) =>
        socket.SendAsync(
            JsonSerializer.SerializeToUtf8Bytes(message, Json.Options),
            WebSocketMessageType.Text, true, CancellationToken.None);

    private static async Task<JsonElement> Receive(WebSocket socket)
    {
        var buffer = new byte[8192];
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        var result = await socket.ReceiveAsync(buffer, timeout.Token);
        return JsonDocument.Parse(Encoding.UTF8.GetString(buffer, 0, result.Count)).RootElement;
    }

    private static async Task<JsonElement> Expect(WebSocket socket, string type)
    {
        var message = await Receive(socket);
        Assert.Equal(type, message.GetProperty("type").GetString());
        return message;
    }

    [Fact]
    public async Task QuickMatchPlaysARound()
    {
        using var alice = await Connect();
        using var bob = await Connect();
        await Send(alice, new { type = "quick", lang = "en", name = "Alice" });
        await Expect(alice, "waiting");
        await Send(bob, new { type = "quick", lang = "en", name = "Bob" });

        var aliceStart = await Expect(alice, "start");
        var bobStart = await Expect(bob, "start");
        Assert.Equal("Bob", aliceStart.GetProperty("opponent").GetString());
        Assert.Equal("Alice", bobStart.GetProperty("opponent").GetString());
        Assert.Equal(Seed, aliceStart.GetProperty("seed").GetUInt32());
        Assert.Equal(1, aliceStart.GetProperty("stars").GetInt32());

        // Alice's picks show up for Bob.
        await Send(alice, new { type = "pick", tiles = seqs.Take(2) });
        var picks = await Expect(bob, "pick");
        Assert.Equal(seqs.Take(2), picks.GetProperty("tiles").EnumerateArray().Select(e => e.GetInt32()));

        // Alice claims the word; both hear about it.
        await Send(alice, new { type = "word", id = 7, tiles = seqs, word });
        var mine = await Expect(alice, "claimed");
        Assert.Equal("you", mine.GetProperty("by").GetString());
        Assert.Equal(7, mine.GetProperty("id").GetInt32());
        var points = mine.GetProperty("points").GetInt32();
        Assert.True(points >= 300);
        Assert.Equal(points, mine.GetProperty("you").GetInt32());
        var theirs = await Expect(bob, "claimed");
        Assert.Equal("opponent", theirs.GetProperty("by").GetString());
        Assert.False(theirs.TryGetProperty("id", out _));
        Assert.Equal(points, theirs.GetProperty("opponent").GetInt32());

        // Bob is too late.
        await Send(bob, new { type = "word", id = 1, tiles = seqs, word });
        var rejected = await Expect(bob, "rejected");
        Assert.Equal("taken", rejected.GetProperty("reason").GetString());

        // Bob leaves: Alice wins.
        await bob.CloseAsync(WebSocketCloseStatus.NormalClosure, null, CancellationToken.None);
        var end = await Expect(alice, "end");
        Assert.Equal("left", end.GetProperty("reason").GetString());
        Assert.Equal(points, end.GetProperty("you").GetInt32());
    }

    [Fact]
    public async Task FriendsMeetInAPrivateRoom()
    {
        using var host = await Connect();
        using var guest = await Connect();
        await Send(host, new { type = "create", lang = "en", name = "Host" });
        var code = (await Expect(host, "room")).GetProperty("code").GetString()!;
        Assert.Matches("^[A-HJKMNP-Z]{4}$", code);

        await Send(guest, new { type = "join", code = "ZZZZ" == code ? "YYYY" : "ZZZZ", lang = "en", name = "Guest" });
        Assert.Equal("noRoom", (await Expect(guest, "error")).GetProperty("reason").GetString());

        await Send(guest, new { type = "join", code = code.ToLowerInvariant(), lang = "ru", name = "Guest" });
        Assert.Equal("language", (await Expect(guest, "error")).GetProperty("reason").GetString());

        await Send(guest, new { type = "join", code, lang = "en", name = "Guest" });
        Assert.Equal("Guest", (await Expect(host, "start")).GetProperty("opponent").GetString());
        Assert.Equal("Host", (await Expect(guest, "start")).GetProperty("opponent").GetString());
    }

    [Fact]
    public async Task RefusesLanguagesWithoutAWordList()
    {
        using var player = await Connect();
        await Send(player, new { type = "quick", lang = "ru", name = "P" });
        Assert.Equal("badRequest", (await Expect(player, "error")).GetProperty("reason").GetString());
        await Send(player, new { nonsense = true });
        await Expect(player, "error");
    }

    [Fact]
    public async Task HealthCheckAnswers()
    {
        var response = await factory.CreateClient().GetAsync("/healthz");
        Assert.True(response.IsSuccessStatusCode);
    }
}
