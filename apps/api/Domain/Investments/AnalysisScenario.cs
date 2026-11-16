using System.Globalization;

namespace Orbit.Api.Domain.Investments;

/// <summary>Which of the three futures a scenario describes.</summary>
public enum ScenarioKind
{
    Base,
    Optimistic,
    Pessimistic,
}

/// <summary>
/// One possible future of the company: how likely it is, the premises behind it (growth, margins, discount
/// rate) and the value per share they lead to.
/// </summary>
public sealed class AnalysisScenario
{
    private const decimal MaxProbability = 100m;

    public ScenarioKind Kind { get; }
    public AnalysisEntries Entries { get; }

    private AnalysisScenario(ScenarioKind kind, AnalysisEntries entries)
    {
        Kind = kind;
        Entries = entries;
    }

    /// <summary>
    /// Builds a scenario of a known kind whose probability, when given, is a percentage from 0 to 100.
    /// </summary>
    /// <example><code>AnalysisScenario.Create(ScenarioKind.Base, AnalysisEntries.Create(texts, metrics, AnalysisFields.Scenario));</code></example>
    public static AnalysisScenario Create(ScenarioKind kind, AnalysisEntries entries)
    {
        if (!Enum.IsDefined(kind))
        {
            throw new DomainRuleException($"Expected the scenario kind to be a known one, received {(int)kind}");
        }
        return new AnalysisScenario(kind, RequireProbability(entries));
    }

    /// <summary>Rebuilds a stored scenario as it was saved, without today's rules.</summary>
    /// <example><code>AnalysisScenario.Restore(ScenarioKind.Pessimistic, entries);</code></example>
    internal static AnalysisScenario Restore(ScenarioKind kind, AnalysisEntries entries) => new(kind, entries);

    private static AnalysisEntries RequireProbability(AnalysisEntries entries)
    {
        if (entries.Metric("probability") is not { } probability) return entries;
        if (probability is >= 0 and <= MaxProbability) return entries;
        throw new DomainRuleException(
            $"Expected the scenario probability to be 0-100 (%), received {probability.ToString(CultureInfo.InvariantCulture)}");
    }
}
