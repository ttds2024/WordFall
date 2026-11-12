using System.Diagnostics;

namespace WordFall.Server;

/// <summary>A connected player, as the lobby and a match see them.</summary>
public interface IPlayer
{
    /// <summary>The name the player gave in the lobby.</summary>
    string Name { get; set; }
    /// <summary>Queues a message; never blocks.</summary>
    void Send(ServerMessage message);
}

/// <summary>
/// A live two-player round: runs MatchState under a lock, answers both players and ends the round
/// when time is up or someone leaves.
/// </summary>
public sealed class Match
{
    private readonly object gate = new();
    private readonly MatchState state;
    private readonly IPlayer[] players;
    private readonly Stopwatch clock = Stopwatch.StartNew();
    private readonly CancellationTokenSource timer = new();
    private readonly Action<Match>? onEnd;
    private bool over;

    public Match(IPlayer first, IPlayer second, MatchState state, Action<Match>? onEnd = null)
    {
        players = [first, second];
        this.state = state;
        this.onEnd = onEnd;
    }

    public bool Over
    {
        get
        {
            lock (gate) return over;
        }
    }

    public IReadOnlyList<IPlayer> Players => players;

    /// <summary>Tells both players the round has started and ends it after <paramref name="durationMs"/>.</summary>
    public void Start(int durationMs = MatchState.RoundMs)
    {
        for (var seat = 0; seat < 2; seat++)
        {
            players[seat].Send(new StartMessage(
                state.Seed, state.Lang, durationMs, players[1 - seat].Name, state.Stars[seat]));
        }
        _ = EndAfter(durationMs);
    }

    private async Task EndAfter(int durationMs)
    {
        try
        {
            await Task.Delay(durationMs, timer.Token);
        }
        catch (OperationCanceledException)
        {
            return;
        }
        lock (gate) End("time");
    }

    public void Handle(IPlayer player, ClientMessage message)
    {
        lock (gate)
        {
            var seat = Array.IndexOf(players, player);
            if (over || seat < 0) return;
            var other = players[1 - seat];
            var elapsed = clock.Elapsed.TotalMilliseconds;
            switch (message.Type)
            {
                case "pick":
                    // Only tile numbers go on: the other player highlights them.
                    var picks = (message.Tiles ?? []).OfType<int>().Take(MatchState.MaxWordLength).ToArray();
                    other.Send(new PickMessage(picks));
                    break;

                case "star" when message.Tile is int tile:
                    var star = state.TakeStar(seat, tile, elapsed);
                    if (star != Rejection.None)
                    {
                        player.Send(new RejectedMessage(null, Reason(star)));
                        break;
                    }
                    player.Send(new StarMessage("you", tile, state.Stars[seat]));
                    other.Send(new StarMessage("opponent", tile, state.Stars[1 - seat]));
                    break;

                case "hat" when message.Hat is int hat && message.Tiles is not null:
                    // A hat that cannot be is ignored: the letters stay as the server has them.
                    var changed = message.Tiles.OfType<int>().ToArray();
                    if (changed.Length == message.Tiles.Length && state.CastHat(seat, hat, changed, elapsed))
                        other.Send(new HatMessage(changed));
                    break;

                case "word" when message.Tiles is not null && message.Word is not null:
                    var result = state.ClaimWord(seat, message.Tiles, message.Word, elapsed);
                    if (result.Rejection != Rejection.None)
                    {
                        player.Send(new RejectedMessage(message.Id, Reason(result.Rejection)));
                        break;
                    }
                    var tiles = result.Tiles ?? [];
                    player.Send(new ClaimedMessage("you", message.Id, result.Word, tiles, result.Points,
                        state.Scores[seat], state.Scores[1 - seat], state.Stars[seat]));
                    other.Send(new ClaimedMessage("opponent", null, result.Word, tiles, result.Points,
                        state.Scores[1 - seat], state.Scores[seat], state.Stars[1 - seat]));
                    break;

                case "leave":
                    Leave(player);
                    break;
            }
        }
    }

    /// <summary>A player left or lost their connection: the other one wins.</summary>
    public void Leave(IPlayer player)
    {
        lock (gate)
        {
            if (over) return;
            var seat = Array.IndexOf(players, player);
            if (seat < 0) return;
            over = true;
            timer.Cancel();
            var other = 1 - seat;
            players[other].Send(new EndMessage(state.Scores[other], state.Scores[seat], "left"));
        }
        onEnd?.Invoke(this);
    }

    private void End(string reason)
    {
        if (over) return;
        over = true;
        for (var seat = 0; seat < 2; seat++)
            players[seat].Send(new EndMessage(state.Scores[seat], state.Scores[1 - seat], reason));
        onEnd?.Invoke(this);
    }

    private static string Reason(Rejection rejection) => rejection switch
    {
        Rejection.Taken => "taken",
        Rejection.Used => "used",
        Rejection.Full => "full",
        _ => "invalid",
    };
}
