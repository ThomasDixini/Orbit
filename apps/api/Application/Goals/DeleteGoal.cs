using Orbit.Api.Domain;

namespace Orbit.Api.Application.Goals;

/// <summary>
/// Deletes a goal from a day on; its past days keep it and its progress. Deleting one already gone
/// succeeds, so retries are harmless.
/// </summary>
public sealed class DeleteGoal(IGoalRepository goals)
{
    /// <summary>
    /// Validates the id and deletes the goal if it exists.
    /// </summary>
    /// <example><code>await deleteGoal.ExecuteAsync("g1", new DateOnly(2026, 10, 28), ct);</code></example>
    public Task ExecuteAsync(string goalId, DateOnly day, CancellationToken cancellationToken)
    {
        return goals.ArchiveAsync(EntityId.Require(goalId, "goal id"), day, cancellationToken);
    }
}
