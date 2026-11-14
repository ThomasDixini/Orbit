using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Orbit.Api.Domain.Investments;
using Orbit.Api.Endpoints;
using Shouldly;

namespace Orbit.Api.Tests.Endpoints;

public sealed class PeriodRateEndpointsTests : IDisposable
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public PeriodRateEndpointsTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose() => _factory.Dispose();

    private Task<HttpResponseMessage> Put(string kind, string month, int basisPoints) =>
        _client.PutAsJsonAsync($"/period-rates/{kind}/{month}", new { basisPoints });

    [Fact]
    public async Task Put_SavesTheRateAndGetListsIt()
    {
        (await Put("selic", "2026-10", 1300)).EnsureSuccessStatusCode();
        (await Put("incomeTax", "2026-10", 1500)).EnsureSuccessStatusCode();

        var listed = await _client.GetFromJsonAsync<List<PeriodRateResponse>>("/period-rates", Json);

        listed!.Select(rate => (rate.Kind, rate.Month, rate.BasisPoints)).ShouldBe(
            [(PeriodRateKind.IncomeTax, "2026-10", 1500), (PeriodRateKind.Selic, "2026-10", 1300)]);
    }

    [Fact]
    public async Task Delete_RemovesTheRateAndAnUnknownOneStillSucceeds()
    {
        (await Put("ipca", "2026-10", 52)).EnsureSuccessStatusCode();

        (await _client.DeleteAsync("/period-rates/ipca/2026-10")).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await _client.DeleteAsync("/period-rates/ipca/2026-10")).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (await _client.GetFromJsonAsync<List<PeriodRateResponse>>("/period-rates", Json))!.ShouldBeEmpty();
    }

    [Theory]
    [InlineData("selic", "2026-13", 1300)]
    [InlineData("selic", "2026-10", 20_000)]
    [InlineData("gold", "2026-10", 1300)]
    public async Task Put_AnInvalidRateIsBadRequest(string kind, string month, int basisPoints)
    {
        var response = await Put(kind, month, basisPoints);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }
}
