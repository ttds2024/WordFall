using System.Text.RegularExpressions;

namespace WordFall.Server;

/// <summary>
/// The playable words of a language, cleaned exactly as the game cleans data/words_&lt;lang&gt;.txt
/// (cleanWordList in src/core/dictionary.ts): lower-case entries only, at least 3 letters of the
/// language's alphabet, Ё folded into Е.
/// </summary>
public sealed partial class WordList
{
    public const int MinWordLength = 3;

    private readonly HashSet<string> words;

    public WordList(IEnumerable<string> words) => this.words = [.. words];

    public int Count => words.Count;

    /// <summary>Whether this word (normalised) is playable.</summary>
    public bool Contains(string word) => words.Contains(Normalize(word));

    /// <summary>Lower case, and Ё treated as Е, as normalizeWord in src/core/word.ts.</summary>
    public static string Normalize(string word) => word.Trim().ToLowerInvariant().Replace('ё', 'е');

    public static WordList Parse(string text, string lang)
    {
        var alphabet = lang == "ru" ? Russian() : English();
        var words = new List<string>();
        foreach (var line in text.Split('\n'))
        {
            var raw = line.Trim();
            if (raw != raw.ToLowerInvariant()) continue;
            var word = Normalize(raw);
            if (word.Length >= MinWordLength && alphabet.IsMatch(word)) words.Add(word);
        }
        return new WordList(words);
    }

    public static WordList Load(string path, string lang) => Parse(File.ReadAllText(path), lang);

    [GeneratedRegex("^[a-z]+$")]
    private static partial Regex English();

    [GeneratedRegex("^[а-я]+$")]
    private static partial Regex Russian();
}

/// <summary>Both languages' word lists, read once at start-up from the data folder.</summary>
public sealed class Dictionaries(IReadOnlyDictionary<string, WordList> lists)
{
    public WordList? For(string lang) => lists.GetValueOrDefault(lang);

    public IEnumerable<string> Languages => lists.Keys;

    /// <summary>
    /// Loads data/words_&lt;lang&gt;.txt for each language found. <paramref name="configured"/> is
    /// the folder to use; when empty, the nearest "data" folder holding a word list, from the
    /// working directory or the app's own folder upwards (the repository's data/ when run from it).
    /// </summary>
    public static Dictionaries Load(string? configured)
    {
        var folder = string.IsNullOrEmpty(configured) ? FindDataFolder() : configured;
        var lists = new Dictionary<string, WordList>();
        foreach (var lang in new[] { "en", "ru" })
        {
            var path = folder is null ? null : Path.Combine(folder, $"words_{lang}.txt");
            if (path is not null && File.Exists(path)) lists[lang] = WordList.Load(path, lang);
        }
        return new Dictionaries(lists);
    }

    private static string? FindDataFolder()
    {
        foreach (var start in new[] { Directory.GetCurrentDirectory(), AppContext.BaseDirectory })
        {
            for (var dir = new DirectoryInfo(start); dir is not null; dir = dir.Parent)
            {
                var data = Path.Combine(dir.FullName, "data");
                if (File.Exists(Path.Combine(data, "words_en.txt")) || File.Exists(Path.Combine(data, "words_ru.txt")))
                    return data;
            }
        }
        return null;
    }
}
