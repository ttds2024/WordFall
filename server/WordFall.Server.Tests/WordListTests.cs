using WordFall.Server;

namespace WordFall.Server.Tests;

public class WordListTests
{
    [Fact]
    public void CleansLikeTheGame()
    {
        var words = WordList.Parse("cat\r\nDog\nab\nice-cream\nhello world\nzebra\n", "en");
        Assert.True(words.Contains("cat"));
        Assert.True(words.Contains("CAT"));
        Assert.True(words.Contains("zebra"));
        Assert.False(words.Contains("dog"));
        Assert.False(words.Contains("ab"));
        Assert.False(words.Contains("ice-cream"));
        Assert.Equal(2, words.Count);
    }

    [Fact]
    public void FoldsYoIntoYe()
    {
        var words = WordList.Parse("ёлка\nмир\nMoscow\n", "ru");
        Assert.True(words.Contains("елка"));
        Assert.True(words.Contains("ЁЛКА"));
        Assert.True(words.Contains("мир"));
        Assert.Equal(2, words.Count);
    }
}
