namespace Orbit.Api.Domain.Finances;

/// <summary>
/// What money went to or came from (food, salary…). Kept apart from the routines
/// <see cref="Categories.Category"/>: a life area and a spending bucket are different things.
/// </summary>
public sealed class FinanceCategory
{
    public const int MaxNameLength = 40;

    public string Id { get; }
    public string Name { get; }

    /// <summary>Whether its transactions count as income and expenses, or only move money.</summary>
    public FinanceCategoryKind Kind { get; }

    private FinanceCategory(string id, string name, FinanceCategoryKind kind)
    {
        Id = id;
        Name = name;
        Kind = kind;
    }

    /// <summary>
    /// Builds a valid finance category, trimming the name.
    /// </summary>
    /// <example><code>FinanceCategory.Create("transfers", " Transfers ", FinanceCategoryKind.Transfer).Name; // "Transfers"</code></example>
    public static FinanceCategory Create(
        string id, string name, FinanceCategoryKind kind = FinanceCategoryKind.Regular)
    {
        return new FinanceCategory(
            EntityId.Require(id, "finance category id"),
            RequiredText.Require(name, MaxNameLength, "finance category name"),
            RequireKind(kind));
    }

    /// <summary>
    /// Rebuilds a stored finance category as it was saved, without today's rules.
    /// </summary>
    /// <example><code>FinanceCategory.Restore("food", "Food", FinanceCategoryKind.Regular);</code></example>
    internal static FinanceCategory Restore(string id, string name, FinanceCategoryKind kind) => new(id, name, kind);

    private static FinanceCategoryKind RequireKind(FinanceCategoryKind kind)
    {
        if (Enum.IsDefined(kind)) return kind;
        throw new DomainRuleException(
            $"Expected the finance category kind to be Regular or Transfer, received {(int)kind}");
    }
}
