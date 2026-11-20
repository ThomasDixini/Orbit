using System.Text.RegularExpressions;

namespace Orbit.Api.Domain.Investments;

/// <summary>
/// Which rate a typed value is: the Selic (per year), the IPCA (per month), the income tax, or a rate of the
/// user's own, named by them (a rate per month, like the IPCA).
/// </summary>
public enum PeriodRateKind
{
    Selic,
    Ipca,
    IncomeTax,
    Custom,
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
    public const int MaxNameLength = 30;
    private const string CustomPrefix = "Custom:";

    public PeriodRateKind Kind { get; }

    /// <summary>What the user called a custom rate; empty for the Selic, the IPCA and the income tax.</summary>
    public string Name { get; }

    /// <summary>The month the rate is for, <c>YYYY-MM</c>.</summary>
    public string Month { get; }

    public int BasisPoints { get; }

    private PeriodRate(PeriodRateKind kind, string name, string month, int basisPoints)
    {
        Kind = kind;
        Name = name;
        Month = month;
        BasisPoints = basisPoints;
    }

    /// <summary>
    /// Builds a valid rate: a known kind, a month written <c>YYYY-MM</c> and a value from -10% to 100%.
    /// </summary>
    /// <example><code>PeriodRate.Create(PeriodRateKind.Selic, "2026-10", 1300).BasisPoints; // 1300</code></example>
    public static PeriodRate Create(PeriodRateKind kind, string month, int basisPoints, string? name = null)
    {
        return new PeriodRate(
            RequireKind(kind), RequireName(kind, name), RequireMonth(month), RequireBasisPoints(basisPoints));
    }

    /// <summary>Rebuilds a stored rate as it was saved, without today's rules.</summary>
    /// <example><code>PeriodRate.Restore(PeriodRateKind.Ipca, "2026-10", 52);</code></example>
    internal static PeriodRate Restore(PeriodRateKind kind, string month, int basisPoints, string? name = null) =>
        new(kind, name ?? "", month, basisPoints);

    /// <summary>
    /// How the kind and name are kept together in storage: the enum name, or <c>Custom:</c> and the name.
    /// </summary>
    /// <example><code>PeriodRate.StorageKey(PeriodRateKind.Custom, "Poupança"); // "Custom:Poupança"</code></example>
    public static string StorageKey(PeriodRateKind kind, string? name) =>
        kind == PeriodRateKind.Custom ? CustomPrefix + (name ?? "").Trim() : kind.ToString();

    /// <summary>
    /// Reads a stored key back into the kind and the name.
    /// </summary>
    /// <example><code>PeriodRate.FromStorageKey("Custom:Poupança"); // (Custom, "Poupança")</code></example>
    public static (PeriodRateKind Kind, string Name) FromStorageKey(string key) =>
        key.StartsWith(CustomPrefix, StringComparison.Ordinal)
            ? (PeriodRateKind.Custom, key[CustomPrefix.Length..])
            : (Enum.Parse<PeriodRateKind>(key), "");

    private static string RequireName(PeriodRateKind kind, string? name)
    {
        if (kind != PeriodRateKind.Custom) return "";
        var text = RequiredText.Require(name ?? "", MaxNameLength, "custom rate name");
        if (Enum.GetNames<PeriodRateKind>().Any(known => string.Equals(known, text, StringComparison.OrdinalIgnoreCase)))
        {
            throw new DomainRuleException(
                $"Expected a custom rate name other than the built-in ones (Selic, Ipca, IncomeTax), received {ReceivedValue.Quote(text)}");
        }
        return text;
    }

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
