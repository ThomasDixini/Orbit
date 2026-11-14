using System.Text.RegularExpressions;

namespace Orbit.Api.Domain.Investments;

/// <summary>Which rate a typed value is: the Selic (per year), the IPCA (per month) or the income tax.</summary>
public enum PeriodRateKind
{
    Selic,
    Ipca,
    IncomeTax,
}

/// <summary>
/// A rate the user typed for one month, such as "the Selic was 13% in October 2026", kept so returns can
/// be compared against it. The value is in basis points (1 bp = 0.01%), so 13% is 1300 and no floating
/// point is stored.
/// </summary>
public sealed partial class PeriodRate
{
    public const int MinBasisPoints = -1_000;
    public const int MaxBasisPoints = 10_000;

    public PeriodRateKind Kind { get; }

    /// <summary>The month the rate is for, <c>YYYY-MM</c>.</summary>
    public string Month { get; }

    public int BasisPoints { get; }

    private PeriodRate(PeriodRateKind kind, string month, int basisPoints)
    {
        Kind = kind;
        Month = month;
        BasisPoints = basisPoints;
    }

    /// <summary>
    /// Builds a valid rate: a known kind, a month written <c>YYYY-MM</c> and a value from -10% to 100%.
    /// </summary>
    /// <example><code>PeriodRate.Create(PeriodRateKind.Selic, "2026-10", 1300).BasisPoints; // 1300</code></example>
    public static PeriodRate Create(PeriodRateKind kind, string month, int basisPoints)
    {
        return new PeriodRate(RequireKind(kind), RequireMonth(month), RequireBasisPoints(basisPoints));
    }

    /// <summary>Rebuilds a stored rate as it was saved, without today's rules.</summary>
    /// <example><code>PeriodRate.Restore(PeriodRateKind.Ipca, "2026-10", 52);</code></example>
    internal static PeriodRate Restore(PeriodRateKind kind, string month, int basisPoints) =>
        new(kind, month, basisPoints);

    /// <summary>
    /// Checks a month and returns it; used by the routes that name a rate without a value.
    /// </summary>
    /// <example><code>PeriodRate.RequireMonth("2026-10"); // "2026-10"</code></example>
    public static string RequireMonth(string month)
    {
        if (month is not null && MonthPattern().IsMatch(month)) return month;
        throw new DomainRuleException(
            $"Expected the rate month to be written YYYY-MM, like 2026-10, received {ReceivedValue.Quote(month ?? "")}");
    }

    private static PeriodRateKind RequireKind(PeriodRateKind kind)
    {
        if (Enum.IsDefined(kind)) return kind;
        throw new DomainRuleException($"Expected the rate kind to be a known one, received {(int)kind}");
    }

    private static int RequireBasisPoints(int basisPoints)
    {
        if (basisPoints is >= MinBasisPoints and <= MaxBasisPoints) return basisPoints;
        throw new DomainRuleException(
            $"Expected the rate to be between {MinBasisPoints} and {MaxBasisPoints} basis points, received {basisPoints}");
    }

    [GeneratedRegex(@"^\d{4}-(0[1-9]|1[0-2])$")]
    private static partial Regex MonthPattern();
}
