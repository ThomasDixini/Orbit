namespace Orbit.Api.Domain.Finances;

/// <summary>Where one invoice of a card stands.</summary>
public enum InvoiceStatus
{
    /// <summary>Closed and fully paid (or it had nothing to pay).</summary>
    Paid,

    /// <summary>Closed, with part of it paid.</summary>
    PartlyPaid,

    /// <summary>Closed, with nothing paid towards it.</summary>
    Unpaid,

    /// <summary>Still taking purchases: today falls in it.</summary>
    Open,

    /// <summary>Starts after today; holds installments bought ahead.</summary>
    Upcoming,
}

/// <summary>The part of a payment that went to one invoice.</summary>
public sealed record InvoicePaymentShare(CardPayment Payment, long AmountCents);

/// <summary>
/// One invoice of a card: what was spent on it, what has been paid towards it and by which payments.
/// <see cref="CreditCents"/> is what refunds left over on earlier invoices covered of it.
/// </summary>
public sealed record CardInvoice(
    InvoiceCycle Cycle,
    long AmountCents,
    InvoiceStatus Status,
    IReadOnlyList<InvoicePaymentShare> Payments,
    long CreditCents)
{
    /// <summary>What was paid towards it: its payment shares plus the credit it used.</summary>
    public long PaidCents => Payments.Sum(share => share.AmountCents) + CreditCents;

    /// <summary>What is still to pay on it; never below zero.</summary>
    public long RemainingCents => Math.Max(0, AmountCents - PaidCents);
}
