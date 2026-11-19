using Orbit.Api.Domain;
using Orbit.Api.Domain.Investments;
using Shouldly;

namespace Orbit.Api.Tests.Domain;

public class BalanceLedgerTests
{
    private static readonly DateOnly December1 = new(2025, 12, 1);
    private static readonly DateOnly December9 = new(2025, 12, 9);
    private static readonly DateOnly December31 = new(2025, 12, 31);
    private static readonly DateOnly January20 = new(2026, 1, 20);

    private static BalanceEntry Entry(string id, DateOnly date, BalanceEntryKind kind, long cents) =>
        BalanceEntry.Create(id, "rdb", date, kind, cents);

    private static readonly BalanceEntry[] Statement =
    [
        Entry("a", December1, BalanceEntryKind.Opening, 237_351),
        Entry("b", December9, BalanceEntryKind.Deposit, 88_400),
        Entry("c", December31, BalanceEntryKind.Yield, 4_024),
        Entry("d", December31, BalanceEntryKind.IncomeTax, 600),
        Entry("e", January20, BalanceEntryKind.Withdrawal, 50_000),
    ];

    [Fact]
    public void Entry_AddsOrTakesFromTheBalanceByItsKind()
    {
        Statement.Select(entry => entry.BalanceEffectCents)
            .ShouldBe([237_351L, 88_400L, 4_024L, -600L, -50_000L]);
    }

    [Fact]
    public void Entry_NeedsAnAmountAboveZeroAndAKnownKind()
    {
        Should.Throw<DomainRuleException>(() => Entry("x", December1, BalanceEntryKind.Deposit, 0));
        Should.Throw<DomainRuleException>(() => Entry("x", December1, (BalanceEntryKind)99, 100));
    }

    [Fact]
    public void BalanceAt_AddsWhatHappenedUpToTheDay()
    {
        (BalanceLedger.BalanceAt(Statement, "rdb", December9), BalanceLedger.BalanceAt(Statement, "rdb", January20))
            .ShouldBe((325_751L, 279_175L));
    }

    [Fact]
    public void BalanceAt_IgnoresOtherInvestments()
    {
        BalanceLedger.BalanceAt(Statement, "caixinha", January20).ShouldBe(0);
    }

    [Fact]
    public void PrincipalAt_IsWhatWasPutInMinusWhatWasWithdrawn_NotCountingYieldOrWhatWasTakenOutOfIt()
    {
        (BalanceLedger.PrincipalAt(Statement, "rdb", December31), BalanceLedger.PrincipalAt(Statement, "rdb", January20))
            .ShouldBe((325_751L, 275_751L));
    }

    [Fact]
    public void PrincipalAt_NeverGoesBelowZero()
    {
        BalanceEntry[] entries =
        [
            Entry("a", December1, BalanceEntryKind.Deposit, 10_000), Entry("b", December9, BalanceEntryKind.Withdrawal, 15_000),
        ];

        BalanceLedger.PrincipalAt(entries, "rdb", December31).ShouldBe(0);
    }

    [Fact]
    public void AsFlows_TurnsTheMoneyPutInAndTakenOutIntoPurchasesAndSalesOfOneUnit()
    {
        var flows = BalanceLedger.AsFlows(Statement);

        flows.Select(flow => (flow.Kind, flow.TotalCents, flow.Date)).ShouldBe([
            (TradeKind.Buy, 237_351L, December1),
            (TradeKind.Buy, 88_400L, December9),
            (TradeKind.Sell, 50_000L, January20),
        ]);
    }
}
