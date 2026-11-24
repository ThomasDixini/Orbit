/**
 * Brazilian Portuguese for transfers between accounts (money that is neither income nor an expense) and
 * for the invoice history of a card (what paid each invoice, payments made by someone else), keyed by
 * the English text.
 */
export const PT_BR_TRANSFERS_INVOICES: Readonly<Record<string, string>> = {
  // Transfer categories
  Transfer: 'Movimentação',
  'Mark as transfer': 'Marcar como movimentação',
  'Count as income/expense': 'Contar como ganho/gasto',
  'Mark {name} as a transfer between accounts': 'Marcar {name} como movimentação entre contas',
  'Count {name} as income and expenses': 'Contar {name} como ganho e gasto',
  'Transfers move money between accounts: they are not counted as income or expenses.':
    'Movimentações só passam dinheiro entre contas: não contam como ganho nem como gasto.',

  // Invoice history
  Invoices: 'Faturas',
  'Still owed: {amount}': 'Em aberto: {amount}',
  'Each payment settles the oldest invoice still owed first.':
    'Cada pagamento quita primeiro a fatura mais antiga em aberto.',
  "Couldn't load the invoices.": 'Não foi possível carregar as faturas.',
  'No invoices yet.': 'Nenhuma fatura ainda.',
  'Invoice due {day}': 'Fatura vence {day}',
  '{amount} still to pay': 'faltam {amount}',
  '{part} of a {total} payment': '{part} de um pagamento de {total}',
  'Paid by': 'Pago por',
  'Refund credit': 'Crédito de estorno',
  Settled: 'Paga',
  'Partly paid': 'Paga em parte',
  Unpaid: 'Não paga',
  Open: 'Aberta',
  'Coming up': 'Futura',

  // Payments made by someone else
  'Paid by someone else': 'Pago por outra pessoa',
  'Mark as paid by someone else': 'Marcar como paga por outra pessoa',
  'Who paid {amount}': 'Quem pagou {amount}',
  'Mark as paid': 'Marcar como paga',
  'Someone else paid it': 'Outra pessoa pagou',
  'Who paid': 'Quem pagou',
  'E.g. Sister': 'Ex.: Irmã',

  // An expense that paid a card invoice
  'It paid a card invoice': 'É pagamento de fatura',
  'It leaves your expenses and lowers what the card owes.':
    'Sai dos seus gastos e reduz o que o cartão deve.',
  'Card whose invoice it paid': 'Cartão da fatura paga',
  'Turn into invoice payment': 'Transformar em pagamento de fatura',
  'Recorded as a payment of {cardName}.': 'Registrado como pagamento de {cardName}.',
  'the card': 'o cartão',
};
