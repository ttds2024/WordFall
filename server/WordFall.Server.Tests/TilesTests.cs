using System.Text.Json;
using WordFall.Server;

namespace WordFall.Server.Tests;

public class TilesTests
{
    private sealed record Case(string Lang, uint Seed, int Index, string Kind, string Letter, double X);

    private static Case[] Fixture() =>
        JsonSerializer.Deserialize<Case[]>(
            File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "tiles.json")),
            new JsonSerializerOptions(JsonSerializerDefaults.Web))!;

    [Fact]
    public void MatchesTheGamesTiles()
    {
        var cases = Fixture();
        Assert.NotEmpty(cases);
        foreach (var c in cases)
        {
            var spec = Tiles.Spec(c.Seed, c.Index, c.Lang);
            Assert.Equal(c.Kind, spec.Kind.ToString().ToLowerInvariant());
            Assert.Equal(c.Letter, spec.Letter);
            Assert.Equal(c.X, spec.X);
        }
    }

    [Fact]
    public void Mulberry32GivesNumbersInTheUnitInterval()
    {
        var random = new Mulberry32(42);
        for (var i = 0; i < 1000; i++)
        {
            var n = random.Next();
            Assert.InRange(n, 0, 0.9999999999);
        }
    }
}
