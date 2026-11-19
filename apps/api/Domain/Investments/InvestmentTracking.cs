namespace Orbit.Api.Domain.Investments;

/// <summary>
/// How an investment is followed: by its purchases and sales of units at a price (stocks, funds), or by its
/// balance like a bank statement (deposits, withdrawals, yield and what is taken out of it), as a savings box
/// or a fixed-income product shows it.
/// </summary>
public enum InvestmentTracking
{
    Trades,
    Balance,
}
