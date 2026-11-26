using Orbit.Api.Application;
using Orbit.Api.Application.Finances;
using Orbit.Api.Domain;
using Orbit.Api.Domain.Finances;
using Orbit.Api.Tests.Fakes;
using Shouldly;

namespace Orbit.Api.Tests.Application;

public class CardInvoiceUseCaseTests
{
    private static readonly DateOnly Today = new(2026, 11, 24);
    private static readonly DateOnly September20 = new(2026, 9, 20);

    private readonly InMemoryAccountRepository _accounts = new(
        Account.CreateBankAccount("bb", "BB"),
        Account.CreateCreditCard("santander", "Santander", CardTerms.Create(1_000_000, 8, 12)));
    private readonly InMemoryMoneyTransactionRepository _transactions = new();
    private readonly InMemoryCardPaymentRepository _payments = new();

    private ListCardInvoices ListInvoices => new(_accounts, _transactions, _payments);

    private ConvertTransactionToCardPayment Convert =>
        new(_transactions, _accounts, _payments, new ImmediateUnitOfWork());

    private Task StoreAsync(string id, string accountId, long cents) =>
        _transactions.SaveAsync(
            MoneyTransaction.Create(id, September20, "Line", "food", accountId, cents), CancellationToken.None);

    [Fact]
    public async Task List_SettlesTheCardInvoicesWithItsPayments()
    {
        await StoreAsync("purchase", "santander", -21917);
        await _payments.SaveAsync(
            CardPayment.CreatePaidByOthers("sister", (await _accounts.FindAsync("santander", CancellationToken.None))!, "Sister", Today, 21917),
            CancellationToken.None);

        var invoices = await ListInvoices.ExecuteAsync("santander", Today, CancellationToken.None);

        (invoices[0].Status, invoices[0].Payments.Single().Payment.PaidBy).ShouldBe((InvoiceStatus.Paid, "Sister"));
    }

    [Fact]
    public async Task List_RejectsABankAccount()
    {
        await Should.ThrowAsync<DomainRuleException>(() => ListInvoices.ExecuteAsync("bb", Today, CancellationToken.None));
    }

    [Fact]
    public async Task List_RejectsAnUnknownCard()
    {
        await Should.ThrowAsync<ResourceNotFoundException>(() => ListInvoices.ExecuteAsync("amex", Today, CancellationToken.None));
    }

    [Fact]
    public async Task Convert_ReplacesTheExpenseWithAPaymentOfTheSameIdDayAndAmount()
    {
        await StoreAsync("bb-boleto", "bb", -21917);

        var payment = await Convert.ExecuteAsync(new ConvertTransactionToCardPaymentCommand("bb-boleto", "santander"), CancellationToken.None);

        (payment.Id, payment.CardId, payment.FromAccountId, payment.Date, payment.AmountCents)
            .ShouldBe(("bb-boleto", "santander", "bb", September20, 21917L));
        (await _transactions.FindAsync("bb-boleto", CancellationToken.None)).ShouldBeNull();
    }

    [Fact]
    public async Task Convert_RejectsIncome()
    {
        await StoreAsync("salary", "bb", 500000);

        var exception = await Should.ThrowAsync<DomainRuleException>(() =>
            Convert.ExecuteAsync(new ConvertTransactionToCardPaymentCommand("salary", "santander"), CancellationToken.None));

        exception.Message.ShouldContain("\"salary\"");
        (await _transactions.FindAsync("salary", CancellationToken.None)).ShouldNotBeNull();
    }

    [Fact]
    public async Task Convert_RejectsAPurchaseOnACard()
    {
        await StoreAsync("purchase", "santander", -1000);

        await Should.ThrowAsync<DomainRuleException>(() =>
            Convert.ExecuteAsync(new ConvertTransactionToCardPaymentCommand("purchase", "santander"), CancellationToken.None));
    }

    [Fact]
    public async Task Convert_RejectsAnUnknownTransaction()
    {
        await Should.ThrowAsync<ResourceNotFoundException>(() =>
            Convert.ExecuteAsync(new ConvertTransactionToCardPaymentCommand("ghost", "santander"), CancellationToken.None));
    }
}
