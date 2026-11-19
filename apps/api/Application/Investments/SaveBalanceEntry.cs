using Orbit.Api.Domain;
using Orbit.Api.Domain.Investments;

namespace Orbit.Api.Application.Investments;

public sealed record SaveBalanceEntryCommand(
    string Id, string InvestmentId, DateOnly Date, BalanceEntryKind Kind, long AmountCents);

/// <summary>
/// Records or replaces a line of the statement of a balance-tracked investment; saving the same one twice
/// leaves the same state.
/// </summary>
public sealed class SaveBalanceEntry(IInvestmentRepository investments)
{
    /// <summary>
    /// Checks the investment exists and is followed by its balance, then stores the entry.
    /// </summary>
    /// <example><code>await saveBalanceEntry.ExecuteAsync(new SaveBalanceEntryCommand("b1", "rdb", day, BalanceEntryKind.Deposit, 88400), ct);</code></example>
    public async Task<BalanceEntry> ExecuteAsync(SaveBalanceEntryCommand command, CancellationToken cancellationToken)
    {
        var entry = BalanceEntry.Create(command.Id, command.InvestmentId, command.Date, command.Kind, command.AmountCents);
        var investment = await investments.FindAsync(entry.InvestmentId, cancellationToken)
            ?? throw ResourceNotFoundException.For("investment", entry.InvestmentId);
        if (investment.Tracking != InvestmentTracking.Balance)
        {
            throw new ConflictException(
                $"Expected investment \"{investment.Id}\" to be followed by its balance to take balance entries, found it followed by trades");
        }
        await investments.SaveBalanceEntryAsync(entry, cancellationToken);
        return entry;
    }
}

/// <summary>Deletes a balance entry; deleting one already gone succeeds, so retries are harmless.</summary>
public sealed class DeleteBalanceEntry(IInvestmentRepository investments)
{
    /// <summary>
    /// Validates the id and removes the entry if it exists.
    /// </summary>
    /// <example><code>await deleteBalanceEntry.ExecuteAsync("b1", ct);</code></example>
    public Task ExecuteAsync(string entryId, CancellationToken cancellationToken)
    {
        return investments.DeleteBalanceEntryAsync(EntityId.Require(entryId, "balance entry id"), cancellationToken);
    }
}
