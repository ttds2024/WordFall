namespace WordFall.Server;

/// <summary>What a tile is: see TileKind in src/core/tiles.ts.</summary>
public enum TileKind
{
    Pumpkin,
    Double,
    Bomb,
    Green,
    Ghost,
    Hat,
    Joker,
}

/// <summary>The n-th tile of a round: its kind, its letter (upper case; empty for a bomb or a magic hat) and where it enters.</summary>
public readonly record struct TileSpec(TileKind Kind, string Letter, double X);

/// <summary>
/// The round's tiles, worked out exactly as the game does (src/core/tiles.ts and
/// src/core/letters.ts), so the server knows every tile's letter and kind without being told.
/// Any change there must be made here too; server/fixtures/tiles.json checks both.
/// </summary>
public static class Tiles
{
    public const string JokerLetter = "★";

    public const double JokerChance = 0.04;
    public const double BombChance = 0.1;
    public const double DoubleChance = 0.08;
    public const double GreenChance = 0.05;
    public const double GhostChance = 0.05;
    public const double HatChance = 0.04;

    // Letter frequencies, in the same order as LETTER_WEIGHTS (the order changes the result).
    private static readonly (string Letter, double Weight)[] English =
    [
        ("E", 12.7), ("T", 9.1), ("A", 8.2), ("O", 7.5), ("I", 7.0), ("N", 6.7), ("S", 6.3),
        ("H", 6.1), ("R", 6.0), ("D", 4.3), ("L", 4.0), ("C", 2.8), ("U", 2.8), ("M", 2.4),
        ("W", 2.4), ("F", 2.2), ("G", 2.0), ("Y", 2.0), ("P", 1.9), ("B", 1.5), ("V", 1.0),
        ("K", 0.8), ("J", 0.15), ("X", 0.15), ("Q", 0.1), ("Z", 0.07),
    ];

    private static readonly (string Letter, double Weight)[] Russian =
    [
        ("О", 10.97), ("Е", 8.49), ("А", 8.01), ("И", 7.35), ("Н", 6.7), ("Т", 6.26),
        ("С", 5.47), ("Р", 4.73), ("В", 4.54), ("Л", 4.4), ("К", 3.49), ("М", 3.21),
        ("Д", 2.98), ("П", 2.81), ("У", 2.62), ("Я", 2.01), ("Ы", 1.9), ("Ь", 1.74),
        ("Г", 1.7), ("З", 1.65), ("Б", 1.59), ("Ч", 1.44), ("Й", 1.21), ("Х", 0.97),
        ("Ж", 0.94), ("Ш", 0.73), ("Ю", 0.64), ("Ц", 0.48), ("Щ", 0.36), ("Э", 0.32),
        ("Ф", 0.26), ("Ъ", 0.04),
    ];

    public static bool IsLanguage(string? lang) => lang is "en" or "ru";

    /// <summary>The tile number <paramref name="index"/> (from 0) of the round with this seed.</summary>
    public static TileSpec Spec(uint seed, int index, string lang)
    {
        var random = new Mulberry32(seed ^ unchecked((uint)(index + 1) * 0x9E3779B1u));
        var x = random.Next();
        var roll = random.Next();
        if (roll < JokerChance) return new(TileKind.Joker, JokerLetter, x);
        if (roll < JokerChance + BombChance) return new(TileKind.Bomb, "", x);
        if (roll < JokerChance + BombChance + DoubleChance)
            return new(TileKind.Double, PickLetter(lang, random), x);
        if (roll < JokerChance + BombChance + DoubleChance + GreenChance)
            return new(TileKind.Green, PickLetter(lang, random), x);
        if (roll < JokerChance + BombChance + DoubleChance + GreenChance + GhostChance)
            return new(TileKind.Ghost, PickLetter(lang, random), x);
        if (roll < JokerChance + BombChance + DoubleChance + GreenChance + GhostChance + HatChance)
            return new(TileKind.Hat, "", x);
        return new(TileKind.Pumpkin, PickLetter(lang, random), x);
    }

    /// <summary>
    /// The letter of tile number <paramref name="index"/> once magic hats have changed it
    /// <paramref name="changes"/> times: changedLetter in src/core/tiles.ts.
    /// </summary>
    public static string Letter(uint seed, int index, string lang, int changes)
    {
        var letter = Spec(seed, index, lang).Letter;
        for (var n = 1; n <= changes; n++)
        {
            var random = new Mulberry32(
                seed ^ unchecked((uint)(index + 1) * 0x9E3779B1u) ^ unchecked((uint)n * 0x85EBCA6Bu));
            var next = PickLetter(lang, random);
            while (next == letter) next = PickLetter(lang, random);
            letter = next;
        }
        return letter;
    }

    private static string PickLetter(string lang, Mulberry32 random)
    {
        var entries = lang == "ru" ? Russian : English;
        var total = 0.0;
        foreach (var (_, weight) in entries) total += weight;
        var r = random.Next() * total;
        foreach (var (letter, weight) in entries)
        {
            r -= weight;
            if (r < 0) return letter;
        }
        return entries[^1].Letter;
    }
}

/// <summary>Mulberry32, bit for bit as mulberry32 in src/core/tiles.ts.</summary>
public sealed class Mulberry32(uint seed)
{
    private uint state = seed;

    /// <summary>A number in [0, 1).</summary>
    public double Next()
    {
        unchecked
        {
            state += 0x6D2B79F5u;
            var t = state;
            t = (t ^ (t >> 15)) * (t | 1u);
            t ^= t + (t ^ (t >> 7)) * (t | 61u);
            return (t ^ (t >> 14)) / 4294967296.0;
        }
    }
}
