using System.Text.Json;
using System.Text.Json.Serialization;

namespace WordFall.Server;

/// <summary>
/// Any message from a player (see ClientMessage in src/net/protocol.ts): one shape with every
/// field optional, so a frame is read once and then checked for what its type needs.
/// </summary>
public sealed record ClientMessage(
    string? Type,
    string? Lang = null,
    string? Name = null,
    string? Code = null,
    int?[]? Tiles = null,
    int? Tile = null,
    int? Id = null,
    string? Word = null);

/// <summary>Messages to a player (see ServerMessage in src/net/protocol.ts).</summary>
public abstract record ServerMessage(string Type);

public sealed record WaitingMessage() : ServerMessage("waiting");

public sealed record RoomMessage(string Code) : ServerMessage("room");

public sealed record StartMessage(uint Seed, string Lang, int DurationMs, string Opponent, int Stars)
    : ServerMessage("start");

public sealed record PickMessage(int[] Tiles) : ServerMessage("pick");

public sealed record StarMessage(string By, int Tile, int Stars) : ServerMessage("star");

public sealed record ClaimedMessage(
    string By,
    int? Id,
    string Word,
    int[] Tiles,
    int Points,
    int You,
    int Opponent,
    int Stars) : ServerMessage("claimed");

public sealed record RejectedMessage(int? Id, string Reason) : ServerMessage("rejected");

public sealed record EndMessage(int You, int Opponent, string Reason) : ServerMessage("end");

public sealed record ErrorMessage(string Reason) : ServerMessage("error");

public static class Json
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static string Write(ServerMessage message) =>
        JsonSerializer.Serialize(message, message.GetType(), Options);

    /// <summary>Reads a player's frame; null when it is not a JSON object with a type.</summary>
    public static ClientMessage? Read(string text)
    {
        try
        {
            var message = JsonSerializer.Deserialize<ClientMessage>(text, Options);
            return message?.Type is null ? null : message;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
