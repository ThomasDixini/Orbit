using Orbit.Api.Application.Investments;
using Orbit.Api.Domain;
using Orbit.Api.Domain.Investments;

namespace Orbit.Api.Endpoints;

/// <summary>Body of <c>PUT /period-rates/{kind}/{month}</c>; the kind and month come from the route.</summary>
public sealed record SavePeriodRateRequest(int BasisPoints);

public sealed record PeriodRateResponse(PeriodRateKind Kind, string Month, int BasisPoints)
{
    public static PeriodRateResponse From(PeriodRate rate) => new(rate.Kind, rate.Month, rate.BasisPoints);
}

/// <summary>HTTP routes for the monthly rates (Selic, IPCA, income tax) the user typed.</summary>
public static class PeriodRateEndpoints
{
    /// <summary>
    /// Maps <c>GET /period-rates</c> and <c>PUT</c>/<c>DELETE /period-rates/{kind}/{month}</c>.
    /// </summary>
    /// <example><code>app.MapPeriodRateEndpoints();</code></example>
    public static IEndpointRouteBuilder MapPeriodRateEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/period-rates", ListAsync);
        routes.MapPut("/period-rates/{kind}/{month}", SaveAsync);
        routes.MapDelete("/period-rates/{kind}/{month}", DeleteAsync);
        return routes;
    }

    private static async Task<IResult> ListAsync(ListPeriodRates list, CancellationToken cancellationToken)
    {
        var rates = await list.ExecuteAsync(cancellationToken);
        return Results.Ok(rates.Select(PeriodRateResponse.From).ToList());
    }

    private static async Task<IResult> SaveAsync(
        string kind, string month, SavePeriodRateRequest request, SavePeriodRate save,
        CancellationToken cancellationToken)
    {
        var command = new SavePeriodRateCommand(ParseKind(kind), month, request.BasisPoints);
        return Results.Ok(PeriodRateResponse.From(await save.ExecuteAsync(command, cancellationToken)));
    }

    private static async Task<IResult> DeleteAsync(
        string kind, string month, DeletePeriodRate delete, CancellationToken cancellationToken)
    {
        await delete.ExecuteAsync(ParseKind(kind), month, cancellationToken);
        return Results.NoContent();
    }

    // The route spells the kind like the JSON does (selic, ipca, incomeTax); the binder would not read that.
    private static PeriodRateKind ParseKind(string kind)
    {
        if (Enum.TryParse<PeriodRateKind>(kind, ignoreCase: true, out var parsed) && Enum.IsDefined(parsed)) return parsed;
        throw new DomainRuleException(
            $"Expected the rate kind to be selic, ipca or incomeTax, received {ReceivedValue.Quote(kind)}");
    }
}
