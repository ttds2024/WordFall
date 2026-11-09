using System.Security.Cryptography;

namespace WordFall.Server;

/// <summary>
/// Pairs players up: a quick-match queue per language, and private rooms joined by a 4-letter
/// code. Each player is in at most one of: the queue, a room of their own, a match.
/// </summary>
public sealed class Lobby(Dictionaries dictionaries, ILogger<Lobby> logger, uint? fixedSeed = null)
{
    /// <summary>Room code letters: no I, L or O, which look like 1 and 0.</summary>
    private const string CodeLetters = "ABCDEFGHJKMNPQRSTUVWXYZ";
    public const int MaxNameLength = 24;

    private readonly object gate = new();
    private readonly Dictionary<string, IPlayer> queue = [];
    private readonly Dictionary<string, (IPlayer Host, string Lang)> rooms = [];
    private readonly Dictionary<IPlayer, Match> matches = [];

    public int MatchCount
    {
        get
        {
            lock (gate) return matches.Values.Distinct().Count();
        }
    }

    /// <summary>The name a player gave, tidied and cut to MaxNameLength.</summary>
    public static string CleanName(string? name)
    {
        var clean = new string((name ?? "").Where(c => !char.IsControl(c)).ToArray()).Trim();
        return clean.Length > MaxNameLength ? clean[..MaxNameLength] : clean;
    }

    public void Handle(IPlayer player, ClientMessage message)
    {
        Match? match;
        lock (gate) matches.TryGetValue(player, out match);
        if (match is not null)
        {
            match.Handle(player, message);
            return;
        }

        switch (message.Type)
        {
            case "quick":
                Quick(player, message);
                break;
            case "create":
                Create(player, message);
                break;
            case "join":
                Join(player, message);
                break;
            case "leave":
                Disconnected(player);
                break;
        }
    }

    private bool CheckLanguage(IPlayer player, string? lang)
    {
        if (Tiles.IsLanguage(lang) && dictionaries.For(lang!) is not null) return true;
        player.Send(new ErrorMessage("badRequest"));
        return false;
    }

    private void Quick(IPlayer player, ClientMessage message)
    {
        if (!CheckLanguage(player, message.Lang)) return;
        var lang = message.Lang!;
        IPlayer? opponent;
        lock (gate)
        {
            Forget(player);
            player.Name = CleanName(message.Name);
            if (!queue.Remove(lang, out opponent) || opponent == player)
            {
                queue[lang] = player;
                opponent = null;
            }
        }
        if (opponent is null) player.Send(new WaitingMessage());
        else StartMatch(opponent, player, lang);
    }

    private void Create(IPlayer player, ClientMessage message)
    {
        if (!CheckLanguage(player, message.Lang)) return;
        string code;
        lock (gate)
        {
            Forget(player);
            player.Name = CleanName(message.Name);
            do code = NewCode(); while (rooms.ContainsKey(code));
            rooms[code] = (player, message.Lang!);
        }
        player.Send(new RoomMessage(code));
    }

    private void Join(IPlayer player, ClientMessage message)
    {
        var code = (message.Code ?? "").Trim().ToUpperInvariant();
        (IPlayer Host, string Lang) room;
        lock (gate)
        {
            if (!rooms.TryGetValue(code, out room) || room.Host == player)
            {
                player.Send(new ErrorMessage("noRoom"));
                return;
            }
            if (message.Lang is not null && message.Lang != room.Lang)
            {
                player.Send(new ErrorMessage("language"));
                return;
            }
            Forget(player);
            rooms.Remove(code);
            player.Name = CleanName(message.Name);
        }
        StartMatch(room.Host, player, room.Lang);
    }

    private void StartMatch(IPlayer first, IPlayer second, string lang)
    {
        var seed = fixedSeed ?? BitConverter.ToUInt32(RandomNumberGenerator.GetBytes(4));
        var state = new MatchState(seed, lang, dictionaries.For(lang)!);
        Match match;
        lock (gate)
        {
            match = new Match(first, second, state, Finished);
            matches[first] = match;
            matches[second] = match;
        }
        logger.LogInformation("Match started ({Lang}); {Count} running", lang, MatchCount);
        match.Start();
    }

    /// <summary>A match ended: its players go back to the lobby, free to play again.</summary>
    private void Finished(Match match)
    {
        lock (gate)
        {
            foreach (var (player, m) in matches.ToArray())
                if (m == match) matches.Remove(player);
        }
    }

    /// <summary>The player's connection closed: out of the queue and their room; a match is lost.</summary>
    public void Disconnected(IPlayer player)
    {
        Match? match;
        lock (gate)
        {
            Forget(player);
            matches.Remove(player, out match);
        }
        match?.Leave(player);
    }

    /// <summary>Takes the player out of the queue and any room they opened (under the lock).</summary>
    private void Forget(IPlayer player)
    {
        foreach (var (lang, waiting) in queue.ToArray())
            if (waiting == player) queue.Remove(lang);
        foreach (var (code, room) in rooms.ToArray())
            if (room.Host == player) rooms.Remove(code);
    }

    private static string NewCode() =>
        string.Create(4, 0, (span, _) =>
        {
            for (var i = 0; i < span.Length; i++) span[i] = CodeLetters[RandomNumberGenerator.GetInt32(CodeLetters.Length)];
        });
}
