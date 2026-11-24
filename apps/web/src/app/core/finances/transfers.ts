import { FinanceCategory, isTransferCategory } from './finance-references';
import { Transaction } from './transaction';

/**
 * The ids of the categories that only move money between accounts.
 * @example transferCategoryIds([food, { id: 'transfers', name: 'Transfers', kind: 'transfer' }]) // Set { 'transfers' }
 */
export function transferCategoryIds(categories: readonly FinanceCategory[]): ReadonlySet<string> {
  return new Set(categories.filter(isTransferCategory).map((category) => category.id));
}

/**
 * Whether the transaction only moved money (R$ 1,000 from one's own account, say), so it is neither
 * income nor an expense.
 * @example isTransfer({ ...pix, categoryId: 'transfers' }, new Set(['transfers'])) // true
 */
export function isTransfer(
  transaction: Pick<Transaction, 'categoryId'>,
  transferIds: ReadonlySet<string>,
): boolean {
  return transferIds.has(transaction.categoryId);
}

/**
 * The transactions that count as income or expenses: transfers are left out. Balances still count
 * every transaction; this is for totals of what was earned and spent.
 * @example countedTransactions([salary, pixToSavings], new Set(['transfers'])) // [salary]
 */
export function countedTransactions(
  transactions: readonly Transaction[],
  transferIds: ReadonlySet<string>,
): Transaction[] {
  return transactions.filter((transaction) => !isTransfer(transaction, transferIds));
}

/**
 * Each month's transactions without the transfers, in the same order.
 * @example countedByMonth([september, october], new Set(['transfers'])).length // 2
 */
export function countedByMonth(
  transactionsByMonth: readonly (readonly Transaction[])[],
  transferIds: ReadonlySet<string>,
): Transaction[][] {
  return transactionsByMonth.map((transactions) => countedTransactions(transactions, transferIds));
}
