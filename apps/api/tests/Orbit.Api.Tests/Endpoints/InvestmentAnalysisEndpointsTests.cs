using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Shouldly;

namespace Orbit.Api.Tests.Endpoints;

public sealed class InvestmentAnalysisEndpointsTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public InvestmentAnalysisEndpointsTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose() => _factory.Dispose();

    private static object Analysis(object? metrics = null, object? scenarios = null) => new
    {
        investmentId = "totvs3",
        date = "2026-01-02",
        recommendation = "buy",
        texts = new { thesis = "Leader in ERP", interestRates = "Selic at 15%" },
        metrics = metrics ?? new { roe = 18.5, price = 31.9 },
        peers = new[] { new { name = "SAP", metrics = new { priceToEarnings = 32 } } },
        scenarios = scenarios ?? new[]
        {
            new { kind = "base", texts = new { triggers = "Stable macro" }, metrics = new { probability = 55 } },
        },
    };

    private Task<HttpResponseMessage> SaveTotvs() =>
        _client.PutAsJsonAsync("/investments/totvs3", new { name = "TOTS3", kind = "stock" });

    private async Task<JsonArray> ListAsync() =>
        JsonNode.Parse(await _client.GetStringAsync("/investment-analyses"))!.AsArray();

    [Fact]
    public async Task Put_AnAnalysisIsListedAsSentAndDeletedAgain()
    {
        (await SaveTotvs()).EnsureSuccessStatusCode();
        (await _client.PutAsJsonAsync("/investment-analyses/a1", Analysis())).EnsureSuccessStatusCode();

        var listed = (await ListAsync()).Single()!;
        listed["recommendation"]!.GetValue<string>().ShouldBe("buy");
        listed["texts"]!["interestRates"]!.GetValue<string>().ShouldBe("Selic at 15%");
        listed["metrics"]!["roe"]!.GetValue<decimal>().ShouldBe(18.5m);
        listed["peers"]![0]!["metrics"]!["priceToEarnings"]!.GetValue<decimal>().ShouldBe(32m);
        listed["scenarios"]![0]!["kind"]!.GetValue<string>().ShouldBe("base");
        listed["scenarios"]![0]!["texts"]!["triggers"]!.GetValue<string>().ShouldBe("Stable macro");

        (await _client.DeleteAsync("/investment-analyses/a1")).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await ListAsync()).ShouldBeEmpty();
    }

    [Fact]
    public async Task Put_AnAnalysisWithOnlyItsDayIsAccepted()
    {
        (await SaveTotvs()).EnsureSuccessStatusCode();

        var response = await _client.PutAsJsonAsync(
            "/investment-analyses/a1", new { investmentId = "totvs3", date = "2026-01-02" });

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var saved = JsonNode.Parse(await response.Content.ReadAsStringAsync())!;
        saved["texts"]!.AsObject().ShouldBeEmpty();
        saved["scenarios"]!.AsArray().ShouldBeEmpty();
    }

    [Fact]
    public async Task Put_AnAnalysisOfAnUnknownInvestmentIsNotFound()
    {
        var response = await _client.PutAsJsonAsync("/investment-analyses/a1", Analysis());

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Put_AnUnknownFieldIsBadRequest()
    {
        (await SaveTotvs()).EnsureSuccessStatusCode();

        var response = await _client.PutAsJsonAsync("/investment-analyses/a1", Analysis(metrics: new { mood = 1 }));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).ShouldContain("mood");
    }

    [Fact]
    public async Task Put_AProbabilityOverAHundredIsBadRequest()
    {
        (await SaveTotvs()).EnsureSuccessStatusCode();

        var response = await _client.PutAsJsonAsync("/investment-analyses/a1", Analysis(
            scenarios: new[] { new { kind = "optimistic", metrics = new { probability = 120 } } }));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task DeletingTheInvestment_TakesItsAnalysesWithIt()
    {
        (await SaveTotvs()).EnsureSuccessStatusCode();
        (await _client.PutAsJsonAsync("/investment-analyses/a1", Analysis())).EnsureSuccessStatusCode();

        (await _client.DeleteAsync("/investments/totvs3")).EnsureSuccessStatusCode();

        (await ListAsync()).ShouldBeEmpty();
    }

    [Fact]
    public async Task Get_AnalysesAreNumbersInTheJsonNotText()
    {
        (await SaveTotvs()).EnsureSuccessStatusCode();
        (await _client.PutAsJsonAsync("/investment-analyses/a1", Analysis())).EnsureSuccessStatusCode();

        var listed = (await ListAsync()).Single()!;

        listed["metrics"]!["price"]!.GetValueKind().ShouldBe(JsonValueKind.Number);
    }
}
