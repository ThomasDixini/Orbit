using Orbit.Api.Domain;
using Orbit.Api.Domain.Investments;

namespace Orbit.Api.Application.Investments;

public sealed record SaveMonthPriceCommand(string InvestmentId, string Month, long Cents);

/// <summary>
/// Records the price of one unit of an investment at the end of a month, replacing the one already typed for
/// that month, so saving the same price twice leaves the same state.
/// </summary>
public sealed class SaveMonthPrice(IInvestmentRepository investments)
{
    /// <summary>
    /// Checks the investment exists and is followed by trades (a balance has no unit price), then stores the price.
    /// </summary>
    /// <example><code>await saveMonthPrice.ExecuteAsync(new SaveMonthPriceCommand("tots3", "2026-02", 3100), ct);</code></example>
    public async Task<InvestmentMonthPrice> ExecuteAsync(SaveMonthPriceCommand command, CancellationToken cancellationToken)
    {
        var price = InvestmentMonthPrice.Create(command.InvestmentId, command.Month, command.Cents);
        var investment = await investments.FindAsync(price.InvestmentId, cancellationToken)
            ?? throw ResourceNotFoundException.For("investment", price.InvestmentId);
        if (investment.Tracking != InvestmentTracking.Trades)
        {
            throw new ConflictException(
                $"Expected investment \"{investment.Id}\" to be followed by trades to take month prices, found it followed by its balance");
        }
        await investments.SaveMonthPriceAsync(price, cancellationToken);
        return price;
    }
}

/// <summary>Deletes a typed month price; deleting one already gone succeeds, so retries are harmless.</summary>
public sealed class DeleteMonthPrice(IInvestmentRepository investments)
{
    /// <summary>
    /// Validates the investment id and the month, then removes the price if it exists.
    /// </summary>
    /// <example><code>await deleteMonthPrice.ExecuteAsync("tots3", "2026-02", ct);</code></example>
    public Task ExecuteAsync(string investmentId, string month, CancellationToken cancellationToken)
    {
        var checkedPrice = InvestmentMonthPrice.Create(investmentId, month, 1);
        return investments.DeleteMonthPriceAsync(checkedPrice.InvestmentId, checkedPrice.Month, cancellationToken);
    }
}
