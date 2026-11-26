using Orbit.Api.Application.Finances;
using Orbit.Api.Domain.Finances;

namespace Orbit.Api.Endpoints;

/// <summary>The part of a payment that went to one invoice, with where the payment came from.</summary>
public sealed record InvoicePaymentShareResponse(
    string PaymentId, DateOnly Date, long AmountCents, long PaymentAmountCents, string? FromAccountId, string? PaidBy)
{
    public static InvoicePaymentShareResponse From(InvoicePaymentShare share) =>
        new(share.Payment.Id, share.Payment.Date, share.AmountCents, share.Payment.AmountCents,
            share.Payment.FromAccountId, share.Payment.PaidBy);
}

/// <summary>One invoice of a card: its days, total, what paid it and what is left.</summary>
public sealed record CardInvoiceResponse(
    DateOnly StartsOn,
    DateOnly ClosesOn,
    DateOnly DueOn,
    long AmountCents,
    long PaidCents,
    long RemainingCents,
    long CreditCents,
    InvoiceStatus Status,
    IReadOnlyList<InvoicePaymentShareResponse> Payments)
{
    public static CardInvoiceResponse From(CardInvoice invoice) =>
        new(invoice.Cycle.StartsOn, invoice.Cycle.ClosesOn, invoice.Cycle.DueOn, invoice.AmountCents,
            invoice.PaidCents, invoice.RemainingCents, invoice.CreditCents, invoice.Status,
            invoice.Payments.Select(InvoicePaymentShareResponse.From).ToList());
}

/// <summary>Body of <c>POST /transactions/{transactionId}/card-payment</c>: the card the expense paid.</summary>
public sealed record ConvertToCardPaymentRequest(string CardId)
{
    public ConvertTransactionToCardPaymentCommand ToCommand(string transactionId) => new(transactionId, CardId);
}

/// <summary>HTTP routes for a card's invoice history and for turning an expense into an invoice payment.</summary>
public static class CardInvoiceEndpoints
{
    /// <summary>
    /// Maps <c>GET /accounts/{cardId}/invoices?date=YYYY-MM-DD</c> and
    /// <c>POST /transactions/{transactionId}/card-payment</c>.
    /// </summary>
    /// <example><code>app.MapCardInvoiceEndpoints();</code></example>
    public static IEndpointRouteBuilder MapCardInvoiceEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/accounts/{cardId}/invoices", ListAsync);
        routes.MapPost("/transactions/{transactionId}/card-payment", ConvertAsync);
        return routes;
    }

    private static async Task<IResult> ListAsync(
        string cardId, DateOnly date, ListCardInvoices listInvoices, CancellationToken cancellationToken)
    {
        var invoices = await listInvoices.ExecuteAsync(cardId, date, cancellationToken);
        return Results.Ok(invoices.Select(CardInvoiceResponse.From));
    }

    private static async Task<IResult> ConvertAsync(
        string transactionId, ConvertToCardPaymentRequest request, ConvertTransactionToCardPayment convert,
        CancellationToken cancellationToken)
    {
        var payment = await convert.ExecuteAsync(request.ToCommand(transactionId), cancellationToken);
        return Results.Ok(CardPaymentResponse.From(payment));
    }
}
