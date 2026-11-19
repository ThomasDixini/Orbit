namespace Orbit.Api.Domain.Investments;

/// <summary>
/// What the entries of balance-tracked investments add up to. The money put in is the opening balance and the
/// deposits minus the withdrawals, so the gain is what the yield brought minus what was taken out of it
/// (income tax, IOF, fees).
/// </summary>
public static class BalanceLedger
{
    private const long ThousandthsPerUnit = 1000;

    /// <summary>
    /// The balance of one investment at the end of a day.
    /// </summary>
    /// <example><code>BalanceLedger.BalanceAt(entries, "rdb", new DateOnly(2026, 11, 18)); // 586_500</code></example>
    public static long BalanceAt(IEnumerable<BalanceEntry> entries, string investmentId, DateOnly day) =>
        entries.Where(entry => entry.InvestmentId == investmentId && entry.Date <= day)
            .Sum(entry => entry.BalanceEffectCents);

    /// <summary>
    /// The money put in and not yet taken out: opening balance and deposits minus withdrawals, never below zero.
    /// </summary>
    /// <example><code>BalanceLedger.PrincipalAt(entries, "rdb", day);</code></example>
    public static long PrincipalAt(IEnumerable<BalanceEntry> entries, string investmentId, DateOnly day)
    {
        var principal = entries.Where(entry => entry.InvestmentId == investmentId && entry.Date <= day).Sum(PrincipalEffect);
        return Math.Max(0, principal);
    }

    /// <summary>
    /// The money put in and taken out as purchases and sales of one unit, so the portfolio's results (what
    /// was invested, the gain against the CDI) work over the same flows as for any other investment.
    /// </summary>
    /// <example><code>BalanceLedger.AsFlows(entries).Count(trade => trade.Kind == TradeKind.Buy);</code></example>
    public static IReadOnlyList<InvestmentTrade> AsFlows(IEnumerable<BalanceEntry> entries)
    {
        return entries
            .Where(entry => PrincipalEffect(entry) != 0)
            .Select(entry => InvestmentTrade.Create(
                $"balance-{entry.Id}", entry.InvestmentId, entry.Date,
                PrincipalEffect(entry) > 0 ? TradeKind.Buy : TradeKind.Sell,
                ThousandthsPerUnit, entry.AmountCents))
            .ToList();
    }

    private static long PrincipalEffect(BalanceEntry entry) => entry.Kind switch
    {
        BalanceEntryKind.Opening or BalanceEntryKind.Deposit => entry.AmountCents,
        BalanceEntryKind.Withdrawal => -entry.AmountCents,
        _ => 0,
    };
}
