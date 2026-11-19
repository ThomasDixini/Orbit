using Orbit.Api.Domain.Finances;

namespace Orbit.Api.Domain.Investments;

/// <summary>What a line of a balance-tracked investment is.</summary>
public enum BalanceEntryKind
{
    /// <summary>The balance the investment had when it started to be followed; counts as money put in.</summary>
    Opening,
    Deposit,
    Withdrawal,
    Yield,
    IncomeTax,
    Iof,
    Fee,
}

/// <summary>One line of the statement of a balance-tracked investment, on a day.</summary>
public sealed class BalanceEntry
{
    public string Id { get; }
    public string InvestmentId { get; }
    public DateOnly Date { get; }
    public BalanceEntryKind Kind { get; }

    /// <summary>The amount in cents, always above zero; the kind says whether it adds to the balance or takes from it.</summary>
    public long AmountCents { get; }

    private BalanceEntry(string id, string investmentId, DateOnly date, BalanceEntryKind kind, long amountCents)
    {
        Id = id;
        InvestmentId = investmentId;
        Date = date;
        Kind = kind;
        AmountCents = amountCents;
    }

    /// <summary>
    /// Builds a valid entry: ids, a known kind and an amount above zero within the limit.
    /// </summary>
    /// <example><code>BalanceEntry.Create("b1", "rdb", day, BalanceEntryKind.Deposit, 88400).AmountCents; // 88400</code></example>
    public static BalanceEntry Create(
        string id, string investmentId, DateOnly date, BalanceEntryKind kind, long amountCents)
    {
        return new BalanceEntry(
            EntityId.Require(id, "balance entry id"),
            EntityId.Require(investmentId, "balance entry investment id"),
            date,
            RequireKind(kind),
            RequireAmount(amountCents));
    }

    /// <summary>
    /// Rebuilds a stored entry as it was saved, without today's rules.
    /// </summary>
    /// <example><code>BalanceEntry.Restore("b1", "rdb", day, BalanceEntryKind.Deposit, 88400);</code></example>
    internal static BalanceEntry Restore(
        string id, string investmentId, DateOnly date, BalanceEntryKind kind, long amountCents) =>
        new(id, investmentId, date, kind, amountCents);

    /// <summary>What the entry does to the balance: positive adds to it, negative takes from it.</summary>
    public long BalanceEffectCents => Kind switch
    {
        BalanceEntryKind.Opening or BalanceEntryKind.Deposit or BalanceEntryKind.Yield => AmountCents,
        _ => -AmountCents,
    };

    private static BalanceEntryKind RequireKind(BalanceEntryKind kind)
    {
        if (Enum.IsDefined(kind)) return kind;
        throw new DomainRuleException($"Expected the balance entry kind to be a known one, received {(int)kind}");
    }

    private static long RequireAmount(long amountCents)
    {
        if (amountCents > 0 && amountCents <= MoneyTransaction.MaxAbsoluteAmountCents) return amountCents;
        throw new DomainRuleException(
            $"Expected the balance entry amount to be a number of cents from 1 to {MoneyTransaction.MaxAbsoluteAmountCents}, received {amountCents}");
    }
}
