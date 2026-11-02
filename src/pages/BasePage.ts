import { type Page } from '@playwright/test';

export class BasePage {
  constructor(protected readonly page: Page) {}

  async navigateTo(url: string) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  async waitForUrlContaining(urlPart: string, timeout = Number(process.env.PW_NAVIGATION_TIMEOUT_MS || 30_000)) {
    await this.page.waitForURL(`**/*${urlPart}*`, { timeout });
  }

  async currentUrl(): Promise<string> {
    return this.page.url();
  }
}
