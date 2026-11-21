using System.Text.RegularExpressions;
using Orbit.Api.Domain.Finances;

namespace Orbit.Api.Domain.Investments;

/// <summary>
/// The price of one unit of an investment at the end of a month, typed by the user. It wins over the quote
/// fetched for the same month, so a month the quote source gets wrong, or an asset it does not cover, can
/// still be valued.
/// </summary>
public sealed partial record InvestmentMonthPrice
{
    public string InvestmentId { get; }

    /// <summary><c>YYYY-MM</c>.</summary>
    public string Month { get; }

    /// <summary>The price of one unit, in cents, above zero.</summary>
    public long Cents { get; }

    private InvestmentMonthPrice(string investmentId, string month, long cents)
    {
        InvestmentId = investmentId;
        Month = month;
        Cents = cents;
    }

    /// <summary>
    /// Builds a valid price: an investment id, a month written <c>YYYY-MM</c> and cents above zero within the limit.
    /// </summary>
    /// <example><code>InvestmentMonthPrice.Create("tots3", "2026-02", 3100).Cents; // 3100</code></example>
    public static InvestmentMonthPrice Create(string investmentId, string month, long cents)
    {
        return new InvestmentMonthPrice(
            EntityId.Require(investmentId, "month price investment id"), RequireMonth(month), RequireCents(cents));
    }

    /// <summary>
    /// Rebuilds a stored price as it was saved, without today's rules.
    /// </summary>
    /// <example><code>InvestmentMonthPrice.Restore("tots3", "2026-02", 3100);</code></example>
    internal static InvestmentMonthPrice Restore(string investmentId, string month, long cents) =>
        new(investmentId, month, cents);

    private static string RequireMonth(string month)
    {
        if (month is not null && MonthPattern().IsMatch(month)) return month;
        throw new DomainRuleException(
            $"Expected the month price month to be written YYYY-MM, like 2026-10, received \"{month}\"");
    }

    private static long RequireCents(long cents)
    {
        if (cents > 0 && cents <= MoneyTransaction.MaxAbsoluteAmountCents) return cents;
        throw new DomainRuleException(
            $"Expected the month price to be a number of cents from 1 to {MoneyTransaction.MaxAbsoluteAmountCents}, received {cents}");
    }

    [GeneratedRegex(@"^\d{4}-(0[1-9]|1[0-2])$")]
    private static partial Regex MonthPattern();
}
