import { type Page, expect } from '@playwright/test';
import { BasePage } from '../BasePage.js';

// Portal's generic consent-request page, which OBP-OIDC sends the user to for a VRP consent request as well.
export class ConfirmVrpConsentRequestPage extends BasePage {
  private heading = this.page.locator('h1');
  private confirmButton = this.page.locator('button', { hasText: 'Confirm Consent' });
  private consentRequestIdInput = this.page.locator('input[name="consentRequestId"]');
  private errorContainer = this.page.locator('.bg-error-500\\/10');
  private payments = this.page.getByRole('heading', { name: 'Payments you are authorising' });

  constructor(page: Page) {
    super(page);
  }

  async waitForPage() {
    await this.waitForUrlContaining('/obp-consent-request?');
  }

  async verifyPageLoaded() {
    await expect(this.heading).toContainText('Consent Request');
    await expect(this.payments).toBeVisible();
  }

  async hasError(): Promise<boolean> {
    return this.errorContainer.isVisible();
  }

  async confirmConsent() {
    await this.confirmButton.click();
  }

  async getConsentRequestId(): Promise<string | null> {
    return this.consentRequestIdInput.getAttribute('value');
  }
}
