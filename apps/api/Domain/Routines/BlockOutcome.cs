namespace Orbit.Api.Domain.Routines;

/// <summary>How a routine block ended on a given day.</summary>
public enum BlockOutcomeKind
{
    Done,
    Skipped,
}

/// <summary>
/// What the block and its routine were called, and the block's category, when the outcome was recorded.
/// Kept with the outcome so a day of history stays readable after the routine is edited or deleted.
/// </summary>
public sealed record OutcomeLabels(string BlockName, string RoutineName, string? CategoryId);

/// <summary>
/// A routine block completed or skipped on one day, and the time it ended. The day's later blocks
/// move earlier by the time saved; the routine itself never changes.
/// </summary>
public sealed class BlockOutcome
{
    public string RoutineId { get; }
    public string BlockId { get; }
    public DateOnly Date { get; }
    public BlockOutcomeKind Kind { get; }

    /// <summary>When the block ended, shaped like <c>HH:mm</c>.</summary>
    public string At { get; }

    /// <summary>The names recorded with the outcome; null for one stored before names were kept.</summary>
    public OutcomeLabels? Labels { get; }

    private BlockOutcome(
        string routineId, string blockId, DateOnly date, BlockOutcomeKind kind, string at, OutcomeLabels? labels)
    {
        RoutineId = routineId;
        BlockId = blockId;
        Date = date;
        Kind = kind;
        At = at;
        Labels = labels;
    }

    /// <summary>
    /// Builds a valid outcome.
    /// </summary>
    /// <example><code>BlockOutcome.Create("weekdays", "project", new DateOnly(2026, 10, 27), BlockOutcomeKind.Done, "20:40");</code></example>
    public static BlockOutcome Create(
        string routineId, string blockId, DateOnly date, BlockOutcomeKind kind, string at,
        OutcomeLabels? labels = null)
    {
        return new BlockOutcome(
            EntityId.Require(routineId, "routine id"),
            EntityId.Require(blockId, "block id"),
            date,
            kind,
            ClockTime.Require(at, "block end time"),
            labels);
    }

    /// <summary>
    /// Rebuilds a stored outcome as it was saved, without today's rules, so a stricter rule never makes
    /// an old day unreadable.
    /// </summary>
    /// <example><code>BlockOutcome.Restore("weekdays", "project", day, BlockOutcomeKind.Done, "20:40", null);</code></example>
    internal static BlockOutcome Restore(
        string routineId, string blockId, DateOnly date, BlockOutcomeKind kind, string at, OutcomeLabels? labels) =>
        new(routineId, blockId, date, kind, at, labels);
}
