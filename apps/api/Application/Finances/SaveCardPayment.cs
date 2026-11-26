using Orbit.Api.Domain;
using Orbit.Api.Domain.Finances;

namespace Orbit.Api.Application.Finances;

/// <summary>
/// A card payment to record: from one of the person's bank accounts (<paramref name="FromAccountId"/>) or
/// made by someone else (<paramref name="PaidBy"/>), exactly one of the two.
/// </summary>
public sealed record SaveCardPaymentCommand(
    string Id, string CardId, string? FromAccountId, DateOnly Date, long AmountCents, string? PaidBy = null);

/// <summary>Records or replaces a card invoice payment; saving the same payment twice leaves the same state.</summary>
public sealed class SaveCardPayment(ICardPaymentRepository payments, IAccountRepository accounts)
{
    /// <summary>
    /// Finds the card and, for a payment from the person's money, the bank account; validates the payment
    /// and stores it.
    /// </summary>
    /// <example><code>await saveCardPayment.ExecuteAsync(new SaveCardPaymentCommand("p1", "credit-card", "checking-account", day, 234690), ct);</code></example>
    public async Task<CardPayment> ExecuteAsync(SaveCardPaymentCommand command, CancellationToken cancellationToken)
    {
        var card = await RequireAccountAsync(command.CardId, cancellationToken);
        var payment = await BuildAsync(command, card, cancellationToken);
        await payments.SaveAsync(payment, cancellationToken);
        return payment;
    }

    private async Task<CardPayment> BuildAsync(
        SaveCardPaymentCommand command, Account card, CancellationToken cancellationToken)
    {
        var hasAccount = !string.IsNullOrWhiteSpace(command.FromAccountId);
        var hasPayer = !string.IsNullOrWhiteSpace(command.PaidBy);
        if (hasAccount == hasPayer) throw BothOrNeither(command);
        if (hasPayer)
        {
            return CardPayment.CreatePaidByOthers(command.Id, card, command.PaidBy!, command.Date, command.AmountCents);
        }
        var fromAccount = await RequireAccountAsync(command.FromAccountId!, cancellationToken);
        return CardPayment.Create(command.Id, card, fromAccount, command.Date, command.AmountCents);
    }

    private static DomainRuleException BothOrNeither(SaveCardPaymentCommand command) =>
        new("Expected a card payment from an account or paid by someone else, exactly one of them, received account "
            + $"{ReceivedValue.Quote(command.FromAccountId ?? "")} and paid by {ReceivedValue.Quote(command.PaidBy ?? "")}");

    private async Task<Account> RequireAccountAsync(string accountId, CancellationToken cancellationToken)
    {
        var account = await accounts.FindAsync(accountId, cancellationToken);
        return account ?? throw ResourceNotFoundException.For("account", accountId);
    }
}
