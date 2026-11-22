import { expect, test } from './support/test';
import {
  createFinanceCategory,
  createTransaction,
  isoDayOf,
  ownMonth,
  uniqueName,
} from './support/finances-api';

/*
 * Slots 0–3 belong to the Transactions tests, 10–12 to Banks & Cards, 20+ to Income split, 30–33 to
 * To pay & receive and 40 to the Overview. The history reads a year back, so the test looks only at the
 * category it created, which no other test spends on.
 */
const SLOT = 50;

test('the Spending history tab opens the page', async ({ page }) => {
  await page.goto('/finances/transactions');

  await page.getByRole('link', { name: 'Spending history' }).click();

  await expect(page).toHaveURL(/\/finances\/spending-history$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Spending history');
});

test('a category spent this month shows its amount, and choosing it lists what it is made of', async ({
  page,
  request,
}) => {
  const moment = ownMonth(test.info(), SLOT);
  const categoryName = uniqueName(test.info(), 'Courses');
  const description = uniqueName(test.info(), 'Online course');
  const categoryId = await createFinanceCategory(request, categoryName);
  await createTransaction(request, {
    date: isoDayOf(moment, 10),
    description,
    categoryId,
    accountId: 'checking-account',
    amountCents: -12990,
  });
  await page.clock.setFixedTime(moment);

  await page.goto('/finances/spending-history');

  const row = page.getByRole('row').filter({ hasText: categoryName });
  await expect(row).toContainText('R$129.90');
  await row.getByRole('button', { name: categoryName }).click();
  await expect(page.getByRole('region', { name: 'What the category is made of' })).toContainText(
    description,
  );
  // The category column stays in view while the months scroll. It is see-through at rest, so it does not
  // show as a block on the card, and once the months scroll it must cover what passes under it.
  const header = row.getByRole('rowheader');
  const scrolls = await header.evaluate((cell) => {
    const wrap = cell.closest('.table-wrap');
    if (wrap === null || wrap.scrollWidth <= wrap.clientWidth) return false;
    wrap.scrollLeft = wrap.scrollWidth;
    return true;
  });
  if (scrolls) {
    await expect
      .poll(() => header.evaluate((cell) => getComputedStyle(cell).backdropFilter))
      .toBe('blur(16px)');
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
