using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Orbit.Api.Domain.Finances;
using Orbit.Api.Endpoints;
using Shouldly;

namespace Orbit.Api.Tests.Endpoints;

/// <summary>A card's invoice history and turning an expense into an invoice payment, over the starter accounts.</summary>
public sealed class CardInvoiceEndpointsTests : IDisposable
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public CardInvoiceEndpointsTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose() => _factory.Dispose();

    private Task<HttpResponseMessage> RecordAsync(string id, string accountId, long amountCents, string date = "2026-10-05") =>
        _client.PutAsJsonAsync($"/transactions/{id}", new
        {
            date,
            description = "Line",
            categoryId = "food",
            accountId,
            amountCents,
        });

    [Fact]
    public async Task GetInvoices_ShowsWhatPaidEachInvoice()
    {
        (await RecordAsync("purchase", "credit-card", -28640)).EnsureSuccessStatusCode();
        (await _client.PutAsJsonAsync("/card-payments/sister", new
        {
            cardId = "credit-card",
            paidBy = "Sister",
            date = "2026-11-08",
            amountCents = 28640,
        })).EnsureSuccessStatusCode();

        var invoices = await _client.GetFromJsonAsync<CardInvoiceResponse[]>("/accounts/credit-card/invoices?date=2026-11-24", Json);

        var paid = invoices!.Single(invoice => invoice.AmountCents == 28640);
        (paid.Status, paid.RemainingCents, paid.Payments.Single().PaidBy).ShouldBe((InvoiceStatus.Paid, 0L, "Sister"));
    }

    [Fact]
    public async Task GetInvoices_OfABankAccountIsBadRequest()
    {
        var response = await _client.GetAsync("/accounts/checking-account/invoices?date=2026-11-24");

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task PostCardPayment_TurnsTheExpenseIntoAPaymentWithTheSameId()
    {
        (await RecordAsync("boleto", "checking-account", -28640)).EnsureSuccessStatusCode();

        var response = await _client.PostAsJsonAsync("/transactions/boleto/card-payment", new { cardId = "credit-card" });

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var october = await _client.GetFromJsonAsync<TransactionResponse[]>("/transactions?month=2026-10");
        var payments = await _client.GetFromJsonAsync<CardPaymentResponse[]>("/card-payments?month=2026-10");
        (october!.Length, payments!.Single().Id).ShouldBe((0, "boleto"));
    }

    [Fact]
    public async Task PostCardPayment_OfAnUnknownTransactionIsNotFound()
    {
        var response = await _client.PostAsJsonAsync("/transactions/ghost/card-payment", new { cardId = "credit-card" });

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }
}
