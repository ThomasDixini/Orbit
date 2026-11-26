namespace Orbit.Api.Domain.Finances;

/// <summary>
/// Money paid to a credit card to settle its invoice. It is neither income nor an expense: the purchases
/// on the card already counted as expenses. It comes either from one of the person's bank accounts, so it
/// only moves money between accounts, or from someone else (a relative who paid the invoice), so no
/// account of the person's changes.
/// </summary>
public sealed class CardPayment
{
    /// <summary>The longest "paid by" note: a name, not a story.</summary>
    public const int MaxPaidByLength = 40;

    public string Id { get; }
    public string CardId { get; }

    /// <summary>The bank account the money left; absent when someone else paid.</summary>
    public string? FromAccountId { get; }

    /// <summary>Who paid when it was not one of the person's accounts; absent otherwise.</summary>
    public string? PaidBy { get; }

    public DateOnly Date { get; }

    /// <summary>The amount paid, in cents; always above zero.</summary>
    public long AmountCents { get; }

    private CardPayment(
        string id, string cardId, string? fromAccountId, string? paidBy, DateOnly date, long amountCents)
    {
        Id = id;
        CardId = cardId;
        FromAccountId = fromAccountId;
        PaidBy = paidBy;
        Date = date;
        AmountCents = amountCents;
    }

    /// <summary>
    /// Builds a valid payment: to a credit card, from a bank account, of an amount above zero within the
    /// amount limit.
    /// </summary>
    /// <example><code>CardPayment.Create("p1", visa, checking, new DateOnly(2026, 11, 10), 234690).CardId; // "visa"</code></example>
    public static CardPayment Create(string id, Account card, Account fromAccount, DateOnly date, long amountCents)
    {
        return new CardPayment(
            EntityId.Require(id, "card payment id"),
            RequireKind(card, AccountKind.CreditCard, "card"),
            RequireKind(fromAccount, AccountKind.BankAccount, "account it is paid from"),
            paidBy: null,
            date,
            RequireAmount(amountCents));
    }

    /// <summary>
    /// Builds a valid payment someone else made: to a credit card, with who paid it (trimmed), of an amount
    /// above zero within the amount limit.
    /// </summary>
    /// <example><code>CardPayment.CreatePaidByOthers("p2", santander, " Sister ", new DateOnly(2026, 6, 12), 82359).PaidBy; // "Sister"</code></example>
    public static CardPayment CreatePaidByOthers(
        string id, Account card, string paidBy, DateOnly date, long amountCents)
    {
        return new CardPayment(
            EntityId.Require(id, "card payment id"),
            RequireKind(card, AccountKind.CreditCard, "card"),
            fromAccountId: null,
            RequiredText.Require(paidBy, MaxPaidByLength, "name of who paid the card"),
            date,
            RequireAmount(amountCents));
    }

    /// <summary>
    /// Rebuilds a stored payment as it was saved, without today's rules.
    /// </summary>
    /// <example><code>CardPayment.Restore("p1", "visa", "checking-account", null, new DateOnly(2026, 11, 10), 234690);</code></example>
    internal static CardPayment Restore(
        string id, string cardId, string? fromAccountId, string? paidBy, DateOnly date, long amountCents) =>
        new(id, cardId, fromAccountId, paidBy, date, amountCents);

    private static string RequireKind(Account account, AccountKind expected, string role)
    {
        if (account.Kind == expected) return account.Id;
        throw new DomainRuleException(
            $"Expected the {role} of a card payment to be a {expected}, received {account.Kind} {ReceivedValue.Quote(account.Id)}");
    }

    private static long RequireAmount(long amountCents)
    {
        if (amountCents > 0 && amountCents <= MoneyTransaction.MaxAbsoluteAmountCents) return amountCents;
        throw new DomainRuleException(
            $"Expected the card payment amount to be a number of cents from 1 to {MoneyTransaction.MaxAbsoluteAmountCents}, received {amountCents}");
    }
}
