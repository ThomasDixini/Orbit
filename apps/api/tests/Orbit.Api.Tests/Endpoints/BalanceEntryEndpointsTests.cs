using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Orbit.Api.Endpoints;
using Shouldly;

namespace Orbit.Api.Tests.Endpoints;

public sealed class BalanceEntryEndpointsTests : IDisposable
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public BalanceEntryEndpointsTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose() => _factory.Dispose();

    private static object Rdb(string tracking = "balance") => new { name = "RDB Nubank", kind = "fixedIncome", tracking };

    private static object Entry(string kind, long amountCents, string date = "2026-01-02") =>
        new { investmentId = "rdb", date, kind, amountCents };

    private Task<PortfolioResponse?> PortfolioAsync() =>
        _client.GetFromJsonAsync<PortfolioResponse>("/investments?date=2026-01-06", Json);

    [Fact]
    public async Task Put_StoresTheEntriesAndThePortfolioValuesTheInvestmentAtItsBalance()
    {
        (await _client.PutAsJsonAsync("/investments/rdb", Rdb())).EnsureSuccessStatusCode();
        (await _client.PutAsJsonAsync("/investment-balance-entries/b1", Entry("opening", 100_000))).EnsureSuccessStatusCode();
        (await _client.PutAsJsonAsync("/investment-balance-entries/b2", Entry("yield", 1_000, "2026-01-05"))).EnsureSuccessStatusCode();
        (await _client.PutAsJsonAsync("/investment-balance-entries/b3", Entry("incomeTax", 150, "2026-01-05"))).EnsureSuccessStatusCode();

        var portfolio = (await PortfolioAsync())!;

        var line = portfolio.Lines.Single();
        (line.Investment.Tracking, line.CostCents, line.ValueCents, line.GainCents)
            .ShouldBe((Orbit.Api.Domain.Investments.InvestmentTracking.Balance, 100_000L, 100_850L, 850L));
        portfolio.BalanceEntries.Select(entry => entry.Id).ShouldBe(["b1", "b2", "b3"]);
    }

    [Fact]
    public async Task Put_RefusesAnEntryForAnInvestmentFollowedByTrades()
    {
        (await _client.PutAsJsonAsync("/investments/rdb", Rdb("trades"))).EnsureSuccessStatusCode();

        var response = await _client.PutAsJsonAsync("/investment-balance-entries/b1", Entry("deposit", 100));

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Put_RefusesAnAmountOfZero()
    {
        (await _client.PutAsJsonAsync("/investments/rdb", Rdb())).EnsureSuccessStatusCode();

        var response = await _client.PutAsJsonAsync("/investment-balance-entries/b1", Entry("deposit", 0));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Delete_RemovesTheEntryAndSucceedsWhenItIsAlreadyGone()
    {
        (await _client.PutAsJsonAsync("/investments/rdb", Rdb())).EnsureSuccessStatusCode();
        (await _client.PutAsJsonAsync("/investment-balance-entries/b1", Entry("opening", 100_000))).EnsureSuccessStatusCode();

        var first = await _client.DeleteAsync("/investment-balance-entries/b1");
        var again = await _client.DeleteAsync("/investment-balance-entries/b1");

        (first.StatusCode, again.StatusCode, (await PortfolioAsync())!.BalanceEntries.Count)
            .ShouldBe((HttpStatusCode.NoContent, HttpStatusCode.NoContent, 0));
    }
}
