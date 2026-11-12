using WordFall.Server;

namespace WordFall.Server.Tests;

public class MatchStateTests
{
    private const uint Seed = 123456789;
    /// <summary>Late enough in the round that the first 40 tiles have all fallen.</summary>
    private const double Late = 60_000;

    /// <summary>The first tiles of the round of this kind (letters only, or stars).</summary>
    internal static List<(int Seq, TileSpec Spec)> TilesOf(uint seed, string lang, Func<TileSpec, bool> keep, int max = 40) =>
        Enumerable.Range(0, max)
            .Select(seq => (seq, Tiles.Spec(seed, seq, lang)))
            .Where(t => keep(t.Item2))
            .ToList();

    internal static bool IsLetter(TileSpec spec) => spec.Kind is TileKind.Pumpkin or TileKind.Double or TileKind.Ghost;

    /// <summary>Three letter tiles and the "word" they spell, which the test word list accepts.</summary>
    private static (int[] Seqs, string Word, int Doubles) ThreeLetters(int skip = 0)
    {
        var tiles = TilesOf(Seed, "en", IsLetter).Skip(skip).Take(3).ToList();
        var word = string.Concat(tiles.Select(t => t.Spec.Letter)).ToLowerInvariant();
        return (tiles.Select(t => t.Seq).ToArray(), word, tiles.Count(t => t.Spec.Kind == TileKind.Double));
    }

    private static MatchState NewState(params string[] words) => new(Seed, "en", new WordList(words));

    private static int?[] AsClaim(IEnumerable<int> seqs) => seqs.Select(s => (int?)s).ToArray();

    [Fact]
    public void ScoresAWordOnceAndTakesItsTiles()
    {
        var (seqs, word, doubles) = ThreeLetters();
        var state = NewState(word);
        var result = state.ClaimWord(0, AsClaim(seqs), word, Late);
        Assert.Equal(Rejection.None, result.Rejection);
        var expected = 300 * (doubles == 0 ? 1 : doubles * 2);
        Assert.Equal(expected, result.Points);
        Assert.Equal(expected, state.Scores[0]);
        Assert.Equal(0, state.Scores[1]);

        // The other player is too late for the same tiles.
        Assert.Equal(Rejection.Taken, state.ClaimWord(1, AsClaim(seqs), word, Late).Rejection);
    }

    [Fact]
    public void AWordFoundCannotBeScoredAgainWithOtherTiles()
    {
        var first = ThreeLetters();
        var state = NewState(first.Word);
        Assert.Equal(Rejection.None, state.ClaimWord(0, AsClaim(first.Seqs), first.Word, Late).Rejection);
        // The same word from a star and two other letters, if the round has them.
        var others = TilesOf(Seed, "en", IsLetter).Skip(3).ToList();
        var second = others.FirstOrDefault(t => t.Spec.Letter.ToLowerInvariant() == first.Word[1..2]);
        var third = others.FirstOrDefault(t => t.Seq != second.Seq && t.Spec.Letter.ToLowerInvariant() == first.Word[2..3]);
        if (second.Spec.Letter is null || third.Spec.Letter is null) return;
        var claim = new int?[] { null, second.Seq, third.Seq };
        Assert.Equal(Rejection.Used, state.ClaimWord(1, claim, first.Word, Late).Rejection);
    }

    [Fact]
    public void RefusesWordsThatDoNotFitTheTiles()
    {
        var (seqs, word, _) = ThreeLetters();
        var wrong = word[..2] + (word[2] == 'z' ? 'y' : 'z');
        var state = NewState(word, wrong);
        Assert.Equal(Rejection.Invalid, state.ClaimWord(0, AsClaim(seqs), wrong, Late).Rejection);
    }

    [Fact]
    public void RefusesWordsNotInTheList()
    {
        var (seqs, word, _) = ThreeLetters();
        var state = NewState();
        Assert.Equal(Rejection.Invalid, state.ClaimWord(0, AsClaim(seqs), word, Late).Rejection);
    }

    [Fact]
    public void RefusesTilesThatHaveNotFallenYet()
    {
        var (seqs, word, _) = ThreeLetters();
        var state = NewState(word);
        // At the very start only the first few tiles can exist.
        var late = TilesOf(Seed, "en", IsLetter, 200).Where(t => t.Seq > 100).Take(3).ToList();
        var lateWord = string.Concat(late.Select(t => t.Spec.Letter)).ToLowerInvariant();
        var lateState = NewState(lateWord);
        Assert.Equal(Rejection.Invalid, lateState.ClaimWord(0, AsClaim(late.Select(t => t.Seq)), lateWord, 0).Rejection);
        Assert.Equal(Rejection.None, lateState.ClaimWord(0, AsClaim(late.Select(t => t.Seq)), lateWord, 200_000).Rejection);
        Assert.Equal(Rejection.None, state.ClaimWord(0, AsClaim(seqs), word, Late).Rejection);
    }

    [Fact]
    public void RefusesBombsStarsAndGreenPumpkinsInWords()
    {
        var notLetter = TilesOf(Seed, "en", s => !IsLetter(s)).First();
        var (seqs, word, _) = ThreeLetters();
        var claim = AsClaim(seqs);
        claim[0] = notLetter.Seq;
        Assert.Equal(Rejection.Invalid, NewState(word).ClaimWord(0, claim, word, Late).Rejection);
    }

    [Fact]
    public void AGhostPumpkinGoesIntoAWordOnce()
    {
        var ghost = TilesOf(Seed, "en", s => s.Kind == TileKind.Ghost, 400).First();
        var (seqs, _, _) = ThreeLetters();
        var claim = new int?[] { ghost.Seq, seqs[1], seqs[2] };
        var word = string.Concat(claim.Select(seq => Tiles.Spec(Seed, seq!.Value, "en").Letter)).ToLowerInvariant();
        var state = NewState(word);
        const double End = 400_000;
        Assert.Equal(Rejection.None, state.ClaimWord(0, claim, word, End).Rejection);
        Assert.Equal(Rejection.Taken, state.ClaimWord(1, claim, word, End).Rejection);
    }

    [Fact]
    public void AStarFromTheStockStandsForALetterAndIsSpent()
    {
        var (seqs, word, _) = ThreeLetters();
        var state = NewState(word);
        var claim = new int?[] { seqs[0], null, seqs[2] };
        Assert.Equal(MatchState.StartStars, state.Stars[0]);
        Assert.Equal(Rejection.None, state.ClaimWord(0, claim, word, Late).Rejection);
        Assert.Equal(MatchState.StartStars - 1, state.Stars[0]);

        // No stars left: a word with a star is refused.
        var other = ThreeLetters(3);
        var state2 = NewState(word, other.Word);
        Assert.Equal(Rejection.None, state2.ClaimWord(0, claim, word, Late).Rejection);
        Assert.Equal(Rejection.Invalid, state2.ClaimWord(0, new int?[] { null, other.Seqs[1], other.Seqs[2] }, other.Word, Late).Rejection);
    }

    [Fact]
    public void StarsGoToWhoeverTakesThemFirstUpToTheLimit()
    {
        var stars = TilesOf(Seed, "en", s => s.Kind == TileKind.Joker, 400);
        Assert.True(stars.Count >= 3);
        var state = NewState();
        const double End = 400_000;
        Assert.Equal(Rejection.None, state.TakeStar(0, stars[0].Seq, End));
        Assert.Equal(Rejection.Taken, state.TakeStar(1, stars[0].Seq, End));
        Assert.Equal(Rejection.None, state.TakeStar(0, stars[1].Seq, End));
        Assert.Equal(MatchState.MaxStars, state.Stars[0]);
        Assert.Equal(Rejection.Full, state.TakeStar(0, stars[2].Seq, End));
        Assert.Equal(Rejection.None, state.TakeStar(1, stars[2].Seq, End));
        Assert.Equal(Rejection.Invalid, state.TakeStar(1, ThreeLetters().Seqs[0], End));
    }
}
