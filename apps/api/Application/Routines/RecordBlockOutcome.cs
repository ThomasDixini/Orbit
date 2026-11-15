using Orbit.Api.Application.Goals;
using Orbit.Api.Domain.Routines;

namespace Orbit.Api.Application.Routines;

public sealed record RecordBlockOutcomeCommand(
    string RoutineId, string BlockId, DateOnly Date, BlockOutcomeKind Kind, string At);

/// <summary>
/// Records that a block was completed or skipped on a day; recording it again replaces the
/// previous outcome, so a retried request is harmless. Completing a block counts toward the frequency
/// goals of its category; skipping it takes that back. The outcome and the goal progress are stored
/// together: a failure keeps neither.
/// </summary>
public sealed class RecordBlockOutcome(
    IBlockOutcomeRepository outcomes, IRoutineRepository routines, GoalCredits goalCredits, IUnitOfWork unitOfWork)
{
    /// <summary>
    /// Validates the outcome, checks the routine has the block, stores it and updates the goals.
    /// </summary>
    /// <example><code>await recordBlockOutcome.ExecuteAsync(new("weekdays", "project", day, BlockOutcomeKind.Done, "20:40"), ct);</code></example>
    public async Task<BlockOutcome> ExecuteAsync(RecordBlockOutcomeCommand command, CancellationToken cancellationToken)
    {
        var checkedOutcome = BlockOutcome.Create(command.RoutineId, command.BlockId, command.Date, command.Kind, command.At);
        var (routine, block) = await RequireBlockAsync(checkedOutcome, cancellationToken);
        var outcome = BlockOutcome.Create(
            command.RoutineId, command.BlockId, command.Date, command.Kind, command.At,
            new OutcomeLabels(block.Name, routine.Name, block.CategoryId));
        await unitOfWork.RunAsync(async () =>
        {
            await outcomes.SaveAsync(outcome, cancellationToken);
            await UpdateGoalsAsync(outcome, block, cancellationToken);
        }, cancellationToken);
        return outcome;
    }

    private async Task UpdateGoalsAsync(BlockOutcome outcome, RoutineBlock block, CancellationToken cancellationToken)
    {
        var sourceRef = BlockSourceRef.For(outcome.RoutineId, outcome.BlockId);
        if (outcome.Kind == BlockOutcomeKind.Done)
        {
            await goalCredits.CreditBlockAsync(sourceRef, block.CategoryId, outcome.Date, cancellationToken);
            return;
        }
        await goalCredits.RevokeBlockAsync(sourceRef, outcome.Date, cancellationToken);
    }

    private async Task<(Routine Routine, RoutineBlock Block)> RequireBlockAsync(
        BlockOutcome outcome, CancellationToken cancellationToken)
    {
        var routine = await routines.FindAsync(outcome.RoutineId, cancellationToken)
            ?? throw ResourceNotFoundException.For("routine", outcome.RoutineId);
        var block = routine.Blocks.FirstOrDefault(candidate => candidate.Id == outcome.BlockId)
            ?? throw ResourceNotFoundException.For($"block of routine \"{routine.Id}\"", outcome.BlockId);
        return (routine, block);
    }
}

/// <summary>How a routine block is named in the goal progress log.</summary>
internal static class BlockSourceRef
{
    /// <summary>
    /// The reference stored with the progress a block earned.
    /// </summary>
    /// <example><code>BlockSourceRef.For("weekdays", "csharp"); // "weekdays/csharp"</code></example>
    public static string For(string routineId, string blockId) => $"{routineId}/{blockId}";
}
