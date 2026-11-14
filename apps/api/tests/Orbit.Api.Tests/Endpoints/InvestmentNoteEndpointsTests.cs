using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Orbit.Api.Domain.Investments;
using Orbit.Api.Endpoints;
using Shouldly;

namespace Orbit.Api.Tests.Endpoints;

public sealed class InvestmentNoteEndpointsTests : IDisposable
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public InvestmentNoteEndpointsTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose() => _factory.Dispose();

    private static object Note(string text = "Solid balance sheet") => new
    {
        investmentId = "petr4",
        kind = "analysis",
        date = "2026-01-02",
        text,
    };

    private Task<HttpResponseMessage> SavePetr4() =>
        _client.PutAsJsonAsync("/investments/petr4", new { name = "PETR4", kind = "stock", risk = "high" });

    [Fact]
    public async Task Put_SavesTheRiskAndThePortfolioReturnsIt()
    {
        (await SavePetr4()).EnsureSuccessStatusCode();
        (await _client.PutAsJsonAsync("/investment-trades/t1", new
        {
            investmentId = "petr4",
            date = "2026-01-02",
            kind = "buy",
            quantityThousandths = 1000,
            unitPriceCents = 1000,
        })).EnsureSuccessStatusCode();

        var portfolio = await _client.GetFromJsonAsync<PortfolioResponse>("/investments?date=2026-01-06", Json);

        portfolio!.Lines.Single().Investment.Risk.ShouldBe(InvestmentRisk.High);
    }

    [Fact]
    public async Task Put_ANoteIsListedAndDeletedAgain()
    {
        (await SavePetr4()).EnsureSuccessStatusCode();
        (await _client.PutAsJsonAsync("/investment-notes/n1", Note())).EnsureSuccessStatusCode();

        var listed = await _client.GetFromJsonAsync<List<InvestmentNoteResponse>>("/investment-notes", Json);
        listed!.Select(note => note.Text).ShouldBe(["Solid balance sheet"]);

        (await _client.DeleteAsync("/investment-notes/n1")).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await _client.GetFromJsonAsync<List<InvestmentNoteResponse>>("/investment-notes", Json))!.ShouldBeEmpty();
    }

    [Fact]
    public async Task Put_ANoteOfAnUnknownInvestmentIsNotFound()
    {
        var response = await _client.PutAsJsonAsync("/investment-notes/n1", Note());

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Put_ABlankNoteIsBadRequest()
    {
        (await SavePetr4()).EnsureSuccessStatusCode();

        var response = await _client.PutAsJsonAsync("/investment-notes/n1", Note(text: "  "));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }
}
