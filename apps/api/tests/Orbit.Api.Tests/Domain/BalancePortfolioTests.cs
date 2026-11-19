using Orbit.Api.Domain.Investments;
using Shouldly;

namespace Orbit.Api.Tests.Domain;

/// <summary>Investments followed by their balance, in the portfolio and in its monthly history.</summary>
public class BalancePortfolioTests
{
    private static readonly DateOnly December1 = new(2025, 12, 1);
    private static readonly DateOnly December31 = new(2025, 12, 31);
    private static readonly DateOnly January31 = new(2026, 1, 31);
    private static readonly CdiIndex NoCdi = new([]);

    private static Investment Rdb() =>
        Investment.Create("rdb", "RDB Nubank", InvestmentKind.FixedIncome, null, null, InvestmentTracking.Balance);

    private static BalanceEntry Entry(string id, DateOnly date, BalanceEntryKind kind, long cents) =>
        BalanceEntry.Create(id, "rdb", date, kind, cents);

    private static readonly BalanceEntry[] Statement =
    [
        Entry("a", December1, BalanceEntryKind.Opening, 100_000),
        Entry("b", December31, BalanceEntryKind.Yield, 1_000),
        Entry("c", December31, BalanceEntryKind.IncomeTax, 150),
    ];

    [Fact]
    public void Line_IsWorthItsBalanceAndCostsWhatWasPutIn_SoTheGainIsTheYieldAfterWhatWasTakenOut()
    {
        var portfolio = Portfolio.Build([Rdb()], [], [], January31, NoCdi, Statement);

        var line = portfolio.Lines.Single();
        (line.CostCents, line.ValueCents, line.GainCents, portfolio.Totals.UnpricedCount)
            .ShouldBe((100_000L, 100_850L, 850L, 0));
    }

    [Fact]
    public void Line_AfterEverythingWasWithdrawnHoldsNothing()
    {
        BalanceEntry[] closed = [.. Statement, Entry("d", January31, BalanceEntryKind.Withdrawal, 100_850)];

        var line = Portfolio.Build([Rdb()], [], [], January31, NoCdi, closed).Lines.Single();

        (line.QuantityThousandths, line.ValueCents, line.GainCents).ShouldBe((0L, 0L, null));
    }

    [Fact]
    public void Performance_CountsWhatWasPutInAndTakenOutAsPurchasesAndSales()
    {
        BalanceEntry[] withWithdrawal = [.. Statement, Entry("d", January31, BalanceEntryKind.Withdrawal, 40_000)];

        var performance = Portfolio.Build([Rdb()], [], [], January31, NoCdi, withWithdrawal).Performance!;

        (performance.InvestedCents, performance.GainCents).ShouldBe((100_000L, 850L));
    }

    [Fact]
    public void History_ValuesEachMonthAtItsBalanceAtTheEndOfIt()
    {
        var flows = BalanceLedger.AsFlows(Statement);

        var months = PortfolioHistory.Build([Rdb()], flows, [], [], NoCdi, January31, Statement);

        months.Select(point => (point.Month, point.ValueCents, point.AppliedCents))
            .ShouldBe([("2025-12", 100_850L, 100_000L), ("2026-01", 100_850L, 100_000L)]);
    }
}
