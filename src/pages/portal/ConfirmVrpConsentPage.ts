import { type Page, expect } from '@playwright/test';
import { BasePage } from '../BasePage.js';
import { MailpitClient } from '../../helpers/MailpitClient.js';
import { env } from '../../config/env.js';

// Portal's SCA page for a consent. After a correct OTP, Portal returns to OBP-OIDC, which calls Hola's
// /main with consent_status and consent_id; Hola keeps the consent and redirects to a plain /main.
export class ConfirmVrpConsentPage extends BasePage {
  private heading = this.page.locator('h1');
  private otpInput = this.page.locator('input#otp');
  private confirmButton = this.page.locator('button', { hasText: 'Verify' });
  private errorContainer = this.page.locator('.bg-error-500\\/10');
  private mailpit = new MailpitClient();
  private holaCallback?: Promise<string>;

  constructor(page: Page) {
    super(page);
  }

  // OTP_MAILPIT_QUERY may say {LOGIN_USERNAME} where the test user's address goes, so a profile can name the
  // mailbox without naming the user.
  private otpQuery(): string {
    const query = process.env.OTP_MAILPIT_QUERY;
    if (!query) throw new Error('Provide TEST_OTP_VALUE for an isolated fixed-OTP setup, or OTP_MAILPIT_QUERY for a run-owned mailbox');
    return query.split('{LOGIN_USERNAME}').join(env.OBP_LOGIN_USERNAME);
  }

  // OBP's consent challenge mail reads "Your consent challenge : <code>, Application: ..."; the code is 8 digits
  // today, not the six the registration mails use, and the application name may contain digits of its own.
  challengeCode(body: string): string {
    const match = body.match(/consent challenge\s*:\s*([0-9]{4,12})\b/i);
    if (!match) throw new Error('Mail holds no consent challenge code');
    return match[1];
  }

  // Call before the consent is created: the test user's mailbox keeps the challenges of earlier runs.
  async ignoreEarlierOtpMail() {
    if (!env.TEST_OTP_VALUE) await this.mailpit.ignoreExisting(this.otpQuery());
  }

  async waitForPage() {
    await this.waitForUrlContaining('/obp-consent-request-sca');
  }

  async verifyPageLoaded() {
    await expect(this.heading).toContainText('Strong Customer Authentication');
  }

  async enterOtp(otp = env.TEST_OTP_VALUE) {
    if (!otp) {
      const message = await this.mailpit.waitForMessage(this.otpQuery());
      otp = this.challengeCode(message.Text || message.HTML);
    }
    await this.otpInput.fill(otp);
  }

  async confirm() {
    // The callback is a redirect, never a page of its own, so watch for the request before submitting.
    this.holaCallback = this.page.waitForRequest(
      request => /\/main(\.html)?\?/.test(request.url()) && new URL(request.url()).searchParams.has('consent_status'),
      { timeout: 30_000 },
    ).then(request => request.url());
    await this.confirmButton.click();
  }

  async enterOtpAndConfirm(otp = env.TEST_OTP_VALUE) {
    await this.enterOtp(otp);
    await this.confirm();
  }

  // The URL OBP-OIDC called Hola with after the OTP was accepted.
  async verifySuccess(): Promise<string> {
    if (!this.holaCallback) throw new Error('confirm() was not called');
    return this.holaCallback;
  }

  async hasError(): Promise<boolean> {
    return this.errorContainer.isVisible();
  }
}
