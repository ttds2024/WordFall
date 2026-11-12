namespace WordFall.Server;

/// <summary>Why a claim was refused: see RejectReason in src/net/protocol.ts.</summary>
public enum Rejection
{
    None,
    /// <summary>The other player already took one of the tiles.</summary>
    Taken,
    /// <summary>The word has been found already this round.</summary>
    Used,
    /// <summary>Not a word, tiles that cannot be in one, tiles not spawned yet, and the like.</summary>
    Invalid,
    /// <summary>The player already holds the most stars allowed.</summary>
    Full,
}

public readonly record struct WordResult(Rejection Rejection, string Word = "", int[]? Tiles = null, int Points = 0);

/// <summary>
/// The rules of an online round, with nothing about sockets or clocks: both players get the same
/// tiles (from the seed), each tile and each word can be scored once, by whoever claims it first,
/// and scores follow src/core/scoring.ts. Not thread-safe: Match serialises the calls.
/// </summary>
public sealed class MatchState(uint seed, string lang, WordList words)
{
    public const int RoundMs = 2 * 60 * 1000;
    /// <summary>The game releases one tile every this-many ms on average (SPAWN_INTERVAL_MS).</summary>
    public const int SpawnIntervalMs = 900;
    /// <summary>
    /// Tiles a player may be ahead of the clock by: tiles come one or two at a time (SPAWN_MAX_BATCH),
    /// so one may be early, and the rest is for a little lag and rounding.
    /// </summary>
    public const int SpawnSlack = 4;
    public const int StartStars = 1;
    public const int MaxStars = 3;
    public const int PointsPerLetter = 100;
    public const int MaxWordLength = 24;
    /// <summary>The most tiles one magic hat can reach (a few more than fit round it).</summary>
    public const int MaxHatTiles = 12;

    private readonly HashSet<int> claimed = [];
    private readonly HashSet<string> used = [];
    /// <summary>How many times magic hats have changed each tile's letter.</summary>
    private readonly Dictionary<int, int> changes = [];
    /// <summary>The magic hats each player's field has used up.</summary>
    private readonly HashSet<int>[] hats = [[], []];

    public uint Seed => seed;
    public string Lang => lang;
    public int[] Scores { get; } = [0, 0];
    public int[] Stars { get; } = [StartStars, StartStars];

    /// <summary>The highest tile number a player can have seen this far into the round.</summary>
    public static int LastTile(double elapsedMs) => (int)(elapsedMs / SpawnIntervalMs) + SpawnSlack;

    /// <summary>Player <paramref name="seat"/> takes a star from the field into their stock.</summary>
    public Rejection TakeStar(int seat, int tile, double elapsedMs)
    {
        if (tile < 0 || tile > LastTile(elapsedMs)) return Rejection.Invalid;
        if (Tiles.Spec(seed, tile, lang).Kind != TileKind.Joker) return Rejection.Invalid;
        if (claimed.Contains(tile)) return Rejection.Taken;
        if (Stars[seat] >= MaxStars) return Rejection.Full;
        claimed.Add(tile);
        Stars[seat]++;
        return Rejection.None;
    }

    /// <summary>
    /// Magic hat <paramref name="hat"/> touched a tile on player <paramref name="seat"/>'s field
    /// and changes these tiles' letters, each to its next one. Each field has its own physics, so
    /// the same hat works once on each, on whichever letters it lands among there. Returns
    /// whether the letters changed.
    /// </summary>
    public bool CastHat(int seat, int hat, IReadOnlyList<int> tiles, double elapsedMs)
    {
        var last = LastTile(elapsedMs);
        if (hat < 0 || hat > last || Tiles.Spec(seed, hat, lang).Kind != TileKind.Hat) return false;
        if (tiles.Count == 0 || tiles.Count > MaxHatTiles || tiles.Distinct().Count() != tiles.Count) return false;
        foreach (var tile in tiles)
        {
            if (tile < 0 || tile > last) return false;
            // A hat changes plain, ×2 and green letters.
            if (Tiles.Spec(seed, tile, lang).Kind is not (TileKind.Pumpkin or TileKind.Double or TileKind.Green)) return false;
        }
        if (!hats[seat].Add(hat)) return false;
        foreach (var tile in tiles) changes[tile] = changes.GetValueOrDefault(tile) + 1;
        return true;
    }

    /// <summary>The letter tile <paramref name="tile"/> shows now, magic hats' changes included.</summary>
    public string LetterOf(int tile) => Tiles.Letter(seed, tile, lang, changes.GetValueOrDefault(tile));

    /// <summary>
    /// Player <paramref name="seat"/> claims a word made of these tiles, in order (null: a star
    /// from their stock); <paramref name="word"/> is the dictionary word it spells.
    /// </summary>
    public WordResult ClaimWord(int seat, IReadOnlyList<int?> tiles, string word, double elapsedMs)
    {
        if (tiles.Count < WordList.MinWordLength || tiles.Count > MaxWordLength) return new(Rejection.Invalid);
        var stars = tiles.Count(tile => tile is null);
        if (stars > 1 || stars > Stars[seat]) return new(Rejection.Invalid);

        var seqs = tiles.OfType<int>().ToArray();
        if (seqs.Distinct().Count() != seqs.Length) return new(Rejection.Invalid);
        var last = LastTile(elapsedMs);
        var specs = new Dictionary<int, TileSpec>();
        foreach (var seq in seqs)
        {
            if (seq < 0 || seq > last) return new(Rejection.Invalid);
            var spec = Tiles.Spec(seed, seq, lang);
            // Only plain, ×2 and ghost letters go into words.
            if (spec.Kind is not (TileKind.Pumpkin or TileKind.Double or TileKind.Ghost)) return new(Rejection.Invalid);
            specs[seq] = spec;
        }
        if (seqs.Any(claimed.Contains)) return new(Rejection.Taken);

        var normal = WordList.Normalize(word);
        if (normal.Length != tiles.Count) return new(Rejection.Invalid);
        for (var i = 0; i < tiles.Count; i++)
        {
            if (tiles[i] is int seq && WordList.Normalize(LetterOf(seq))[0] != normal[i]) return new(Rejection.Invalid);
        }
        if (!words.Contains(normal)) return new(Rejection.Invalid);
        if (used.Contains(normal)) return new(Rejection.Used);

        var doubles = seqs.Count(seq => specs[seq].Kind == TileKind.Double);
        var points = normal.Length * PointsPerLetter * (doubles == 0 ? 1 : doubles * 2);
        used.Add(normal);
        claimed.UnionWith(seqs);
        Stars[seat] -= stars;
        Scores[seat] += points;
        return new(Rejection.None, normal, seqs, points);
    }
}
