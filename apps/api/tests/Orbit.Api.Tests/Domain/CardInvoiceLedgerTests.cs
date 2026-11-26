using Orbit.Api.Domain.Finances;
using Shouldly;

namespace Orbit.Api.Tests.Domain;

public class CardInvoiceLedgerTests
{
    // Closes on the 8th, due on the 12th, like the Santander card.
    private static readonly CardTerms Terms = CardTerms.Create(1_000_000, closingDay: 8, dueDay: 12);
    private static readonly Account Santander = Account.CreateCreditCard("santander", "Santander", Terms);
    private static readonly Account Checking = Account.CreateBankAccount("bb", "BB");
    private static readonly DateOnly Today = new(2026, 11, 24);

    private static MoneyTransaction Purchase(string id, DateOnly date, long cents) =>
        MoneyTransaction.Create(id, date, "Purchase", "food", "santander", -cents);

    private static CardPayment Payment(string id, DateOnly date, long cents) =>
        CardPayment.Create(id, Santander, Checking, date, cents);

    private static IReadOnlyList<CardInvoice> Build(
        IEnumerable<MoneyTransaction> purchases, IEnumerable<CardPayment>? payments = null) =>
        CardInvoiceLedger.Build(Terms, purchases, payments ?? [], Today);

    [Fact]
    public void Build_GroupsPurchasesByTheInvoiceTheyFallIn()
    {
        var invoices = Build([Purchase("a", new(2026, 9, 20), 10000), Purchase("b", new(2026, 10, 7), 5000), Purchase("c", new(2026, 10, 8), 2000)]);

        invoices.Select(invoice => (invoice.Cycle.ClosesOn, invoice.AmountCents)).ShouldBe([
            (new DateOnly(2026, 10, 8), 15000L), (new DateOnly(2026, 11, 8), 2000L), (new DateOnly(2026, 12, 8), 0L)]);
    }

    [Fact]
    public void Build_APaymentSettlesTheOldestInvoiceFirstAndTheRestGoesToTheNext()
    {
        var invoices = Build(
            [Purchase("a", new(2026, 9, 20), 10000), Purchase("b", new(2026, 10, 20), 8000)],
            [Payment("p1", new(2026, 11, 12), 14000)]);

        invoices.Select(invoice => (invoice.Status, invoice.PaidCents, invoice.RemainingCents)).Take(2).ShouldBe([
            (InvoiceStatus.Paid, 10000L, 0L), (InvoiceStatus.PartlyPaid, 4000L, 4000L)]);
    }

    [Fact]
    public void Build_ShowsWhichPaymentsPaidEachInvoice()
    {
        var invoices = Build(
            [Purchase("a", new(2026, 9, 20), 10000)],
            [Payment("p1", new(2026, 10, 12), 6000), Payment("p2", new(2026, 10, 20), 9000)]);

        invoices[0].Payments.Select(share => (share.Payment.Id, share.AmountCents)).ShouldBe([("p1", 6000L), ("p2", 4000L)]);
    }

    [Fact]
    public void Build_AnInvoiceWithNothingPaidIsUnpaid()
    {
        var invoices = Build([Purchase("a", new(2026, 9, 20), 10000)]);

        (invoices[0].Status, invoices[0].RemainingCents).ShouldBe((InvoiceStatus.Unpaid, 10000L));
    }

    [Fact]
    public void Build_TheInvoiceTodayFallsInIsOpenAndInstallmentsAheadAreUpcoming()
    {
        var invoices = Build([Purchase("a", new(2026, 11, 20), 3000), Purchase("b", new(2026, 12, 20), 3000)]);

        invoices.Select(invoice => invoice.Status).ShouldBe([InvoiceStatus.Open, InvoiceStatus.Upcoming]);
    }

    [Fact]
    public void Build_ARefundLargerThanItsInvoiceCreditsTheNextOne()
    {
        var refund = MoneyTransaction.Create("r", new DateOnly(2026, 9, 25), "Refund", "food", "santander", 4000);
        var invoices = Build([refund, Purchase("a", new(2026, 10, 20), 10000)], [Payment("p1", new(2026, 11, 12), 6000)]);

        (invoices[0].Status, invoices[1].CreditCents, invoices[1].Status).ShouldBe((InvoiceStatus.Paid, 4000L, InvoiceStatus.Paid));
    }

    [Fact]
    public void Build_PaymentsGoInDateOrderWhateverOrderTheyCameIn()
    {
        var invoices = Build(
            [Purchase("a", new(2026, 9, 20), 5000)],
            [Payment("late", new(2026, 10, 30), 5000), Payment("early", new(2026, 10, 10), 5000)]);

        invoices[0].Payments.Single().Payment.Id.ShouldBe("early");
    }
}
