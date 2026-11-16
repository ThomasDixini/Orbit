import { Locator, Page } from '@playwright/test';

/** Page object for the Finances Investments page: stats, holdings, movements and their forms. */
export class InvestmentsPage {
  readonly title: Locator;
  readonly addButton: Locator;

  constructor(private readonly page: Page) {
    this.title = page.getByRole('heading', { level: 1 });
    this.addButton = page.getByRole('button', { name: 'Add investment' });
  }

  /** Opens the Investments page and waits for the portfolio to finish loading. */
  async goto(): Promise<void> {
    const loaded = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname === '/api/investments',
    );
    await this.page.goto('/finances/investments');
    await loaded;
    await this.addButton.waitFor();
  }

  /** Opens the Analysis tab, where the period rates and the investment notes are. */
  async openAnalysis(): Promise<void> {
    await this.page.getByRole('tab', { name: 'Analysis' }).click();
  }

  /** Opens the Fundamentals tab, where the dated fundamental analyses of each investment are. */
  async openFundamentals(): Promise<void> {
    await this.page.getByRole('tab', { name: 'Fundamentals' }).click();
  }

  /**
   * Starts an analysis of the investment (a copy of its latest one), fills the given fields by their form
   * names (like `company.roe`) and waits for the API to store it.
   */
  async addAnalysis(
    name: string,
    date: string,
    fields: Readonly<Record<string, string>>,
  ): Promise<void> {
    await this.openFundamentals();
    await this.pickAnalysed(name);
    await this.page.getByRole('button', { name: 'New analysis' }).click();
    const form = this.page.getByRole('form', { name: 'New fundamental analysis' });
    await form.locator('[name="date"]').fill(date);
    for (const [field, value] of Object.entries(fields)) {
      const input = form.locator(`[name="${field}"]`);
      // Each part of the template is a collapsible block; open the one holding the field first.
      const block = form.locator('details', { has: this.page.locator(`[name="${field}"]`) });
      if (!(await block.evaluate((details) => (details as HTMLDetailsElement).open))) {
        await block.locator('summary').click();
      }
      await input.fill(value);
    }
    await this.storing(() => form.getByRole('button', { name: 'Save analysis' }).click());
  }

  /** Shows the fundamental analyses of the investment with this name. */
  async pickAnalysed(name: string): Promise<void> {
    // By role: the label wraps the select, so its text also holds every option's name.
    await this.page
      .getByRole('combobox', { name: 'Investment', exact: true })
      .selectOption({ label: name });
  }

  /** The entries of the fundamental analyses timeline. */
  analyses(): Locator {
    return this.page.getByRole('region', { name: 'Fundamental analysis' }).locator('li.entry');
  }

  /** Goes back to the Portfolio tab: the charts, the holdings and the movements. */
  async openPortfolio(): Promise<void> {
    await this.page.getByRole('tab', { name: 'Portfolio' }).click();
  }

  /** The holding of the investment with this name. */
  holding(name: string): Locator {
    return this.page.locator('tr.holding').filter({
      has: this.page.locator('.name', { hasText: name }),
    });
  }

  /** The rows of the movements list that mention this investment. */
  movements(name: string): Locator {
    return this.page
      .getByRole('region', { name: 'Movements' })
      .getByRole('listitem')
      .filter({ hasText: name });
  }

  /** Adds an investment with a typed price (like `12,00`) and waits for the API to store it. */
  async addInvestment(name: string, price: string): Promise<void> {
    await this.addButton.click();
    const form = this.page.getByRole('form', { name: 'New investment' });
    await form.getByLabel('Name').fill(name);
    await form.getByLabel('Current price').fill(price);
    await this.storing(() => form.getByRole('button', { name: 'Add investment' }).click());
  }

  /** Records a purchase or sale for the investment; the form closes only when the API accepted it. */
  async trade(name: string, kind: 'Buy' | 'Sell', quantity: string, price: string): Promise<void> {
    await this.page.getByRole('button', { name: `Trade ${name}`, exact: true }).click();
    const form = this.page.getByRole('form', { name: `Trade ${name}` });
    await form.getByRole('button', { name: kind, exact: true }).click();
    await form.getByLabel('Quantity').fill(quantity);
    await form.getByLabel('Price per unit').fill(price);
    await form.getByRole('button', { name: /^Record (purchase|sale)$/ }).click();
  }

  /** Records a provento for the investment and waits for the API to store it. */
  async addIncome(name: string, amount: string): Promise<void> {
    await this.page.getByRole('button', { name: `Add income to ${name}` }).click();
    const form = this.page.getByRole('form', { name: `Income from ${name}` });
    await form.getByLabel('Amount').fill(amount);
    await this.storing(() => form.getByRole('button', { name: 'Record income' }).click());
  }

  /** Rates the investment's risk (like `High risk`) and waits for the API to store it. */
  async setRisk(name: string, risk: string): Promise<void> {
    await this.page.getByRole('button', { name: `Edit ${name}`, exact: true }).click();
    const form = this.page.getByRole('form', { name: 'Edit investment' });
    await form.getByLabel('Risk').selectOption({ label: risk });
    await this.storing(() => form.getByRole('button', { name: 'Save investment' }).click());
  }

  /** Writes a note about the investment (on the Analysis tab) and waits for the API to store it. */
  async addNote(name: string, text: string): Promise<void> {
    await this.openAnalysis();
    await this.page.getByRole('button', { name: 'New note', exact: true }).click();
    const form = this.page.getByRole('form', { name: 'New investment note' });
    await form.getByLabel('Investment').selectOption({ label: name });
    await form.getByLabel('Note text').fill(text);
    await this.storing(() => form.getByRole('button', { name: 'Save', exact: true }).click());
  }

  /** Types a rate (like `13,5`) of the given kind (like `IPCA (per month)`) for the current month and waits for the API. */
  async addRate(kind: string, value: string): Promise<void> {
    await this.openAnalysis();
    const form = this.page.getByRole('form', { name: 'New rate' });
    await form.getByLabel('Rate').selectOption({ label: kind });
    await form.getByLabel('Value (%)').fill(value);
    await this.storing(() => form.getByRole('button', { name: 'Save rate' }).click());
  }

  /** The rows of the period rates section that mention this text. */
  rates(text: string): Locator {
    return this.page
      .getByRole('region', { name: 'Period rates' })
      .getByRole('listitem')
      .filter({ hasText: text });
  }

  /** The notes of the notes section that contain this text. */
  notes(text: string): Locator {
    return this.page
      .getByRole('region', { name: 'Investment notes' })
      .getByRole('listitem')
      .filter({ hasText: text });
  }

  /** Page width beyond the viewport; zero means no horizontal scroll. */
  horizontalOverflow(): Promise<number> {
    return this.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  }

  private async storing(act: () => Promise<void>): Promise<void> {
    const stored = this.page.waitForResponse(
      (response) => response.request().method() === 'PUT' && response.ok(),
    );
    await act();
    await stored;
  }
}
