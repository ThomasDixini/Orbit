namespace Orbit.Api.Domain.Finances;

/// <summary>
/// Whether money filed under a category is earned or spent, or only moves between accounts. A transfer
/// (money sent from one of the person's accounts to another, or to family) changes balances but is never
/// income nor an expense.
/// </summary>
public enum FinanceCategoryKind
{
    /// <summary>Income when money comes in, an expense when it goes out.</summary>
    Regular,

    /// <summary>Money that only moves: left out of income and expense totals.</summary>
    Transfer,
}
