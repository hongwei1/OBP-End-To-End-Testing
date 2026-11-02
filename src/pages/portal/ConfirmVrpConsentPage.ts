import { type Page, expect } from '@playwright/test';
import { BasePage } from '../BasePage.js';
import { MailpitClient } from '../../helpers/MailpitClient.js';
import { env } from '../../config/env.js';

export class ConfirmVrpConsentPage extends BasePage {
  private heading = this.page.locator('h1');
  private otpInput = this.page.locator('input#otp');
  private confirmButton = this.page.locator('button', { hasText: 'Confirm' });
  private successMessage = this.page.locator('text=Consent confirmed. Redirecting...');
  private errorContainer = this.page.locator('.bg-error-500\\/10');

  constructor(page: Page) {
    super(page);
  }

  async waitForPage() {
    await this.waitForUrlContaining('/confirm-vrp-consent');
  }

  async verifyPageLoaded() {
    await expect(this.heading).toContainText('Confirm VRP Consent');
  }

  async enterOtp(otp = env.TEST_OTP_VALUE) {
    if (!otp) {
      const query = process.env.OTP_MAILPIT_QUERY;
      if (!query) throw new Error('Provide TEST_OTP_VALUE for an isolated fixed-OTP setup, or OTP_MAILPIT_QUERY for a run-owned mailbox');
      const mailpit = new MailpitClient();
      const message = await mailpit.waitForMessage(query);
      otp = mailpit.extractOtp(message.Text || message.HTML);
    }
    await this.otpInput.fill(otp);
  }

  async confirm() {
    await this.confirmButton.click();
  }

  async enterOtpAndConfirm(otp = env.TEST_OTP_VALUE) {
    await this.enterOtp(otp);
    await this.confirm();
  }

  async verifySuccess() {
    await expect(this.successMessage).toBeVisible({ timeout: 30_000 });
  }

  async hasError(): Promise<boolean> {
    return this.errorContainer.isVisible();
  }
}
