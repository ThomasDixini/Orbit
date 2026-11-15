using Orbit.Api.Domain.Goals;

namespace Orbit.Api.Application.Goals;

/// <summary>Lists the goals with the progress of their current period, in creation order.</summary>
public sealed class ListGoals(IGoalRepository goals)
{
    /// <summary>
    /// Returns the goals not deleted, their period being the one around <paramref name="day"/> (the client's
    /// today). With <paramref name="includeDeleted"/> it returns the goals as they stood on that day instead,
    /// which still has those deleted later, for a day of the history.
    /// </summary>
    /// <example><code>var all = await listGoals.ExecuteAsync(new DateOnly(2026, 10, 28), false, ct);</code></example>
    public Task<IReadOnlyList<Goal>> ExecuteAsync(DateOnly day, bool includeDeleted, CancellationToken cancellationToken)
    {
        return includeDeleted ? goals.ListExistingOnAsync(day, cancellationToken) : goals.ListAsync(day, cancellationToken);
    }
}
