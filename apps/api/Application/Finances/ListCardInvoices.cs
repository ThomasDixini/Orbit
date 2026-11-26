using Orbit.Api.Domain;
using Orbit.Api.Domain.Finances;

namespace Orbit.Api.Application.Finances;

/// <summary>
/// Every invoice of a credit card, oldest first, with what was paid towards each and by which payments,
/// so it is plain which invoices are settled and which are still owed.
/// </summary>
public sealed class ListCardInvoices(
    IAccountRepository accounts, IMoneyTransactionRepository transactions, ICardPaymentRepository payments)
{
    /// <summary>
    /// Reads the card, its transactions and its payments, and lays them out as invoices as of the day.
    /// </summary>
    /// <example><code>var invoices = await listCardInvoices.ExecuteAsync("santander", new DateOnly(2026, 11, 24), ct);</code></example>
    public async Task<IReadOnlyList<CardInvoice>> ExecuteAsync(
        string cardId, DateOnly asOf, CancellationToken cancellationToken)
    {
        var terms = await RequireCardTermsAsync(EntityId.Require(cardId, "card id"), cancellationToken);
        var cardTransactions = await transactions.ListOnAccountAsync(cardId, cancellationToken);
        var cardPayments = await payments.ListToCardAsync(cardId, cancellationToken);
        return CardInvoiceLedger.Build(terms, cardTransactions, cardPayments, asOf);
    }

    private async Task<CardTerms> RequireCardTermsAsync(string cardId, CancellationToken cancellationToken)
    {
        var account = await accounts.FindAsync(cardId, cancellationToken)
            ?? throw ResourceNotFoundException.For("account", cardId);
        return account.Card ?? throw new DomainRuleException(
            $"Expected account {ReceivedValue.Quote(cardId)} to be a credit card to list its invoices, received a {account.Kind}");
    }
}
