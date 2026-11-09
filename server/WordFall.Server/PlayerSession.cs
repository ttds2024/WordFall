using System.Net.WebSockets;
using System.Text;
using System.Threading.Channels;

namespace WordFall.Server;

/// <summary>
/// One player's WebSocket: reads their JSON messages into the lobby, and writes the server's
/// messages from a queue, so a slow connection never holds up a match.
/// </summary>
public sealed class PlayerSession(WebSocket socket, Lobby lobby, ILogger logger) : IPlayer
{
    /// <summary>The largest message a player may send; real ones are well under 1 KB.</summary>
    public const int MaxMessageBytes = 4096;
    /// <summary>Messages waiting to go out; a player this far behind is dropped.</summary>
    private const int MaxQueued = 256;

    private readonly Channel<string> outbox = Channel.CreateBounded<string>(
        new BoundedChannelOptions(MaxQueued) { SingleReader = true, FullMode = BoundedChannelFullMode.DropWrite });

    public string Name { get; set; } = "";

    public void Send(ServerMessage message)
    {
        if (!outbox.Writer.TryWrite(Json.Write(message)))
            logger.LogWarning("Dropped a message to a player who is not reading");
    }

    /// <summary>Runs until the connection closes.</summary>
    public async Task RunAsync(CancellationToken cancel)
    {
        var writer = WriteAsync(cancel);
        try
        {
            await ReadAsync(cancel);
        }
        catch (Exception e) when (e is WebSocketException or OperationCanceledException)
        {
            // The player went away.
        }
        finally
        {
            lobby.Disconnected(this);
            outbox.Writer.TryComplete();
        }
        await writer;
        if (socket.State is WebSocketState.Open or WebSocketState.CloseReceived)
        {
            try
            {
                await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, null, CancellationToken.None);
            }
            catch (WebSocketException)
            {
                // Already gone.
            }
        }
    }

    private async Task ReadAsync(CancellationToken cancel)
    {
        var buffer = new byte[MaxMessageBytes];
        while (socket.State == WebSocketState.Open)
        {
            var length = 0;
            ValueWebSocketReceiveResult result;
            do
            {
                if (length == buffer.Length)
                {
                    await socket.CloseAsync(WebSocketCloseStatus.MessageTooBig, null, cancel);
                    return;
                }
                result = await socket.ReceiveAsync(buffer.AsMemory(length), cancel);
                length += result.Count;
            } while (!result.EndOfMessage);

            if (result.MessageType == WebSocketMessageType.Close) return;
            if (result.MessageType != WebSocketMessageType.Text) continue;
            var message = Json.Read(Encoding.UTF8.GetString(buffer, 0, length));
            if (message is null) Send(new ErrorMessage("badRequest"));
            else lobby.Handle(this, message);
        }
    }

    private async Task WriteAsync(CancellationToken cancel)
    {
        try
        {
            await foreach (var text in outbox.Reader.ReadAllAsync(cancel))
            {
                if (socket.State != WebSocketState.Open) break;
                await socket.SendAsync(Encoding.UTF8.GetBytes(text), WebSocketMessageType.Text, true, cancel);
            }
        }
        catch (Exception e) when (e is WebSocketException or OperationCanceledException)
        {
            // The player went away; the reader notices too.
        }
    }
}
