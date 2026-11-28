import { Transaction, TransactionType, typeOf } from './transaction';
import { isTransfer } from './transfers';

/** What the list shows: income, expenses, or the transfers that are neither. */
export type TypeFilter = 'all' | TransactionType | 'transfer';

/** What narrows the transactions list; every filter applies at once. */
export interface TransactionFilters {
  readonly type: TypeFilter;
  /** Only this account's transactions; undefined shows every account. */
  readonly accountId: string | undefined;
  /** Text searched in the description and the category name. */
  readonly query: string;
}

export const NO_FILTERS: TransactionFilters = { type: 'all', accountId: undefined, query: '' };

/** Choices of the type filter, in display order. */
export const TYPE_FILTER_OPTIONS: readonly { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expenses' },
  { value: 'transfer', label: 'Transfer' },
];

/**
 * The transactions that pass every filter, in their original order.
 * @example filterTransactions(october, { ...NO_FILTERS, query: 'farmacia' }, categoryNames, transferIds)
 */
export function filterTransactions(
  transactions: readonly Transaction[],
  filters: TransactionFilters,
  categoryNames: ReadonlyMap<string, string>,
  transferIds: ReadonlySet<string>,
): Transaction[] {
  const query = searchKey(filters.query.trim());
  return transactions.filter(
    (transaction) =>
      matchesType(transaction, filters.type, transferIds) &&
      (filters.accountId === undefined || transaction.accountId === filters.accountId) &&
      matchesQuery(transaction, query, categoryNames),
  );
}

/**
 * Text folded for searching: lower case, without accents, so "farmacia" finds "Farmácia".
 * @example searchKey('Farmácia') // 'farmacia'
 */
export function searchKey(text: string): string {
  return text
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

// A transfer has a sign like any transaction, but it is neither income nor an expense.
function matchesType(
  transaction: Transaction,
  type: TypeFilter,
  transferIds: ReadonlySet<string>,
): boolean {
  if (type === 'all') return true;
  if (isTransfer(transaction, transferIds)) return type === 'transfer';
  return typeOf(transaction) === type;
}

function matchesQuery(
  transaction: Transaction,
  query: string,
  categoryNames: ReadonlyMap<string, string>,
): boolean {
  if (query === '') return true;
  const category = categoryNames.get(transaction.categoryId) ?? '';
  return searchKey(`${transaction.description} ${category}`).includes(query);
}
