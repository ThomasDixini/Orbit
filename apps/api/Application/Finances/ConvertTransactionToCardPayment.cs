using Orbit.Api.Domain;
using Orbit.Api.Domain.Finances;

namespace Orbit.Api.Application.Finances;

public sealed record ConvertTransactionToCardPaymentCommand(string TransactionId, string CardId);

/// <summary>
/// Turns an expense that was really the payment of a card invoice (an imported "Pagamento de Boleto -
/// SANTANDER", say) into that card payment: the expense leaves the totals and the card's debt goes down.
/// The payment keeps the transaction's id, day and amount and comes from the same bank account, so the
/// account's balance stays as it was and importing the statement again finds the line already stored.
/// </summary>
public sealed class ConvertTransactionToCardPayment(
    IMoneyTransactionRepository transactions,
    IAccountRepository accounts,
    ICardPaymentRepository payments,
    IUnitOfWork unitOfWork)
{
    /// <summary>
    /// Checks the transaction is an expense on a bank account and the target is a card, then replaces the
    /// transaction with the payment; both writes happen together or not at all.
    /// </summary>
    /// <example><code>var payment = await convert.ExecuteAsync(new ConvertTransactionToCardPaymentCommand("bb-c949e0b36c9b3d99", "santander"), ct);</code></example>
    public async Task<CardPayment> ExecuteAsync(
        ConvertTransactionToCardPaymentCommand command, CancellationToken cancellationToken)
    {
        var transaction = await RequireTransactionAsync(command.TransactionId, cancellationToken);
        var payment = CardPayment.Create(
            transaction.Id,
            await RequireAccountAsync(command.CardId, cancellationToken),
            await RequireAccountAsync(transaction.AccountId, cancellationToken),
            transaction.Date,
            RequireExpense(transaction));
        await unitOfWork.RunAsync(() => ReplaceAsync(transaction, payment, cancellationToken), cancellationToken);
        return payment;
    }

    private async Task ReplaceAsync(MoneyTransaction transaction, CardPayment payment, CancellationToken cancellationToken)
    {
        await transactions.DeleteAsync(transaction.Id, cancellationToken);
        await payments.SaveAsync(payment, cancellationToken);
    }

    private static long RequireExpense(MoneyTransaction transaction)
    {
        if (transaction.AmountCents < 0) return -transaction.AmountCents;
        throw new DomainRuleException(
            $"Expected an expense (money going out) to turn into a card payment, received transaction {ReceivedValue.Quote(transaction.Id)} of {transaction.AmountCents} cents");
    }

    private async Task<MoneyTransaction> RequireTransactionAsync(string transactionId, CancellationToken cancellationToken)
    {
        var id = EntityId.Require(transactionId, "transaction id");
        return await transactions.FindAsync(id, cancellationToken)
            ?? throw ResourceNotFoundException.For("transaction", id);
    }

    private async Task<Account> RequireAccountAsync(string accountId, CancellationToken cancellationToken)
    {
        return await accounts.FindAsync(accountId, cancellationToken)
            ?? throw ResourceNotFoundException.For("account", accountId);
    }
}
