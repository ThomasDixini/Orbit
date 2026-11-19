namespace Orbit.Api.Domain.Investments;

/// <summary>
/// Something money is invested in (a stock, a fund, a bond). It holds the latest price the user typed in;
/// what is owned and what it cost come from its trades.
/// </summary>
public sealed class Investment
{
    public const int MaxNameLength = 40;

    public string Id { get; }
    public string Name { get; }
    public InvestmentKind Kind { get; }

    /// <summary>The latest price of one unit; absent until the user types one.</summary>
    public PricePoint? Price { get; }

    /// <summary>The user's own risk rating; absent until chosen.</summary>
    public InvestmentRisk? Risk { get; }

    /// <summary>Whether it is followed by purchases and sales at a price, or by its balance like a statement.</summary>
    public InvestmentTracking Tracking { get; }

    private Investment(
        string id, string name, InvestmentKind kind, PricePoint? price, InvestmentRisk? risk, InvestmentTracking tracking)
    {
        Id = id;
        Name = name;
        Kind = kind;
        Price = price;
        Risk = risk;
        Tracking = tracking;
    }

    /// <summary>
    /// Builds a valid investment: trimmed name and a known kind.
    /// </summary>
    /// <example><code>Investment.Create("petr4", "PETR4", InvestmentKind.Stock, PricePoint.Create(3845, day)).Name; // "PETR4"</code></example>
    public static Investment Create(
        string id, string name, InvestmentKind kind, PricePoint? price, InvestmentRisk? risk = null,
        InvestmentTracking tracking = InvestmentTracking.Trades)
    {
        return new Investment(
            EntityId.Require(id, "investment id"),
            RequiredText.Require(name, MaxNameLength, "investment name"),
            RequireKind(kind),
            price,
            RequireRisk(risk),
            RequireTracking(tracking));
    }

    /// <summary>
    /// Rebuilds a stored investment as it was saved, without today's rules.
    /// </summary>
    /// <example><code>Investment.Restore("petr4", "PETR4", InvestmentKind.Stock, null);</code></example>
    internal static Investment Restore(
        string id, string name, InvestmentKind kind, PricePoint? price, InvestmentRisk? risk = null,
        InvestmentTracking tracking = InvestmentTracking.Trades) =>
        new(id, name, kind, price, risk, tracking);

    private static InvestmentTracking RequireTracking(InvestmentTracking tracking)
    {
        if (Enum.IsDefined(tracking)) return tracking;
        throw new DomainRuleException($"Expected the investment tracking to be a known one, received {(int)tracking}");
    }

    private static InvestmentRisk? RequireRisk(InvestmentRisk? risk)
    {
        if (risk is not { } value || Enum.IsDefined(value)) return risk;
        throw new DomainRuleException($"Expected the investment risk to be a known one, received {(int)value}");
    }

    private static InvestmentKind RequireKind(InvestmentKind kind)
    {
        if (Enum.IsDefined(kind)) return kind;
        throw new DomainRuleException($"Expected the investment kind to be a known one, received {(int)kind}");
    }
}
