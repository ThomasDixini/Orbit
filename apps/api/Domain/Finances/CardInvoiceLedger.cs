namespace Orbit.Api.Domain.Finances;

/// <summary>
/// Every invoice of a credit card with what paid it. Payments settle the oldest debt first, the same rule
/// the card's balance follows: each payment, in date order, goes to the oldest invoice not yet paid, and
/// what is left of it to the next one. An invoice whose refunds exceed its purchases leaves a credit that
/// later invoices use before any payment.
/// </summary>
public static class CardInvoiceLedger
{
    /// <summary>
    /// The card's invoices that had purchases or refunds, oldest first, plus the open one even when it is
    /// empty; installments dated ahead show as upcoming invoices.
    /// </summary>
    /// <example><code>CardInvoiceLedger.Build(terms, cardTransactions, payments, today).Last().Status; // InvoiceStatus.Open or Upcoming</code></example>
    public static IReadOnlyList<CardInvoice> Build(
        CardTerms terms, IEnumerable<MoneyTransaction> transactions, IEnumerable<CardPayment> payments, DateOnly today)
    {
        var open = terms.CycleContaining(today);
        var pool = new PaymentPool(payments);
        return TotalsByCycle(terms, transactions, open)
            .Select(total => Settle(total.Cycle, total.AmountCents, open, pool))
            .ToList();
    }

    private static IEnumerable<(InvoiceCycle Cycle, long AmountCents)> TotalsByCycle(
        CardTerms terms, IEnumerable<MoneyTransaction> transactions, InvoiceCycle open)
    {
        var totals = transactions
            .GroupBy(transaction => terms.CycleContaining(transaction.Date))
            .ToDictionary(group => group.Key, group => -group.Sum(transaction => transaction.AmountCents));
        totals.TryAdd(open, 0);
        return totals.OrderBy(total => total.Key.ClosesOn).Select(total => (total.Key, total.Value));
    }

    private static CardInvoice Settle(InvoiceCycle cycle, long amountCents, InvoiceCycle open, PaymentPool pool)
    {
        if (amountCents < 0) pool.AddCredit(-amountCents);
        var due = Math.Max(0, amountCents);
        var creditCents = pool.TakeCredit(due);
        var shares = pool.TakePayments(due - creditCents);
        var paidCents = creditCents + shares.Sum(share => share.AmountCents);
        return new CardInvoice(cycle, amountCents, StatusOf(cycle, open, due, paidCents), shares, creditCents);
    }

    private static InvoiceStatus StatusOf(InvoiceCycle cycle, InvoiceCycle open, long dueCents, long paidCents)
    {
        if (cycle.StartsOn >= open.ClosesOn) return InvoiceStatus.Upcoming;
        if (cycle == open) return InvoiceStatus.Open;
        if (paidCents >= dueCents) return InvoiceStatus.Paid;
        return paidCents > 0 ? InvoiceStatus.PartlyPaid : InvoiceStatus.Unpaid;
    }

    /// <summary>What the payments and refund credits still have to give, oldest payment first.</summary>
    private sealed class PaymentPool(IEnumerable<CardPayment> payments)
    {
        // Stable sort: payments of one day keep the order they were recorded in.
        private readonly CardPayment[] _payments = payments.OrderBy(payment => payment.Date).ToArray();
        private int _oldest;
        private long _oldestLeftCents = -1;
        private long _creditCents;

        public void AddCredit(long cents) => _creditCents += cents;

        public long TakeCredit(long wantedCents)
        {
            var taken = Math.Min(wantedCents, _creditCents);
            _creditCents -= taken;
            return taken;
        }

        public IReadOnlyList<InvoicePaymentShare> TakePayments(long wantedCents)
        {
            var shares = new List<InvoicePaymentShare>();
            while (wantedCents > 0 && _oldest < _payments.Length)
            {
                var share = TakeFromOldest(wantedCents);
                shares.Add(share);
                wantedCents -= share.AmountCents;
            }
            return shares;
        }

        private InvoicePaymentShare TakeFromOldest(long wantedCents)
        {
            var payment = _payments[_oldest];
            var leftCents = _oldestLeftCents < 0 ? payment.AmountCents : _oldestLeftCents;
            var taken = Math.Min(wantedCents, leftCents);
            _oldestLeftCents = leftCents - taken;
            if (_oldestLeftCents == 0) MoveToNextPayment();
            return new InvoicePaymentShare(payment, taken);
        }

        private void MoveToNextPayment()
        {
            _oldest++;
            _oldestLeftCents = -1;
        }
    }
}
