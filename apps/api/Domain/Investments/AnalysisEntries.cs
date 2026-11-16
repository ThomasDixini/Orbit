using System.Globalization;

namespace Orbit.Api.Domain.Investments;

/// <summary>
/// The texts and numbers one part of an analysis holds, each under a field name its catalog knows. Blank
/// texts are dropped, so an untouched field and an erased one are the same thing: absent.
/// </summary>
public sealed class AnalysisEntries
{
    public const int MaxTextLength = 2000;

    /// <summary>Numbers beyond this (either sign) are typos: no ratio, price or cash flow gets that far.</summary>
    public const decimal MaxMetricMagnitude = 1_000_000_000_000m;

    public static readonly AnalysisEntries Empty =
        new(new Dictionary<string, string>(), new Dictionary<string, decimal>());

    public IReadOnlyDictionary<string, string> Texts { get; }
    public IReadOnlyDictionary<string, decimal> Metrics { get; }

    private AnalysisEntries(IReadOnlyDictionary<string, string> texts, IReadOnlyDictionary<string, decimal> metrics)
    {
        Texts = texts;
        Metrics = metrics;
    }

    /// <summary>
    /// Builds the entries of one part, refusing a field its catalog does not know, a text over 2000
    /// characters and a number beyond a trillion.
    /// </summary>
    /// <example><code>AnalysisEntries.Create(new Dictionary&lt;string, string&gt; { ["moat"] = "Brand" }, new Dictionary&lt;string, decimal&gt; { ["roe"] = 18.5m }, AnalysisFields.Company);</code></example>
    public static AnalysisEntries Create(
        IReadOnlyDictionary<string, string> texts, IReadOnlyDictionary<string, decimal> metrics, AnalysisFields fields)
    {
        var keptTexts = texts
            .Where(entry => !string.IsNullOrWhiteSpace(entry.Value))
            .ToDictionary(entry => RequireTextKey(entry.Key, fields), entry => RequireText(entry.Key, entry.Value, fields));
        var keptMetrics = metrics.ToDictionary(
            entry => RequireMetricKey(entry.Key, fields), entry => RequireMetric(entry.Key, entry.Value, fields));
        return new AnalysisEntries(keptTexts, keptMetrics);
    }

    /// <summary>Rebuilds stored entries as they were saved, without today's rules.</summary>
    /// <example><code>AnalysisEntries.Restore(storedTexts, storedMetrics);</code></example>
    internal static AnalysisEntries Restore(
        IReadOnlyDictionary<string, string> texts, IReadOnlyDictionary<string, decimal> metrics) =>
        new(texts, metrics);

    /// <summary>The number stored under the field, if any.</summary>
    /// <example><code>entries.Metric("probability"); // 55m</code></example>
    public decimal? Metric(string key) => Metrics.TryGetValue(key, out var value) ? value : null;

    private static string RequireTextKey(string key, AnalysisFields fields)
    {
        if (fields.HasText(key)) return key;
        throw new DomainRuleException(
            $"Expected a known {fields.Part} text field, received {ReceivedValue.Quote(key)}");
    }

    private static string RequireMetricKey(string key, AnalysisFields fields)
    {
        if (fields.HasMetric(key)) return key;
        throw new DomainRuleException(
            $"Expected a known {fields.Part} number field, received {ReceivedValue.Quote(key)}");
    }

    private static string RequireText(string key, string text, AnalysisFields fields)
    {
        if (text.Length <= MaxTextLength) return text;
        throw new DomainRuleException(
            $"Expected the {fields.Part} text \"{key}\" to have at most {MaxTextLength} characters, received {ReceivedValue.Quote(text)}");
    }

    private static decimal RequireMetric(string key, decimal value, AnalysisFields fields)
    {
        if (Math.Abs(value) <= MaxMetricMagnitude) return value;
        throw new DomainRuleException(
            $"Expected the {fields.Part} number \"{key}\" to be within ±{MaxMetricMagnitude.ToString(CultureInfo.InvariantCulture)}, received {value.ToString(CultureInfo.InvariantCulture)}");
    }
}
