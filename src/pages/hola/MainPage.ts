import { type Page, expect } from '@playwright/test';
import { BasePage } from '../BasePage.js';
import { env } from '../../config/env.js';

export class MainPage extends BasePage {
  private getAccountsButton = this.page.locator('#get_accounts_obp');
  private consentInfoButton = this.page.locator('#consent_info_obp');
  private revokeConsentButton = this.page.locator('#revoke_consent_obp');

  constructor(page: Page) {
    super(page);
  }

  async waitForMainPage() {
    await this.waitForUrlContaining('/main');
  }

  // callbackUrl: the URL OBP-OIDC called Hola's /main with (consent_status, consent_id); Hola redirects from it
  // to a plain /main, so the current URL no longer carries them.
  async verifyConsentAccepted(callbackUrl?: string) {
    const url = new URL(callbackUrl || this.page.url());
    expect(url.searchParams.get('consent_status') || url.searchParams.get('status')).toBe('ACCEPTED');
    if (callbackUrl) expect(url.searchParams.get('consent_id')).toBeTruthy();
  }

  async verifyConsentRequestIdPresent() {
    const url = new URL(this.page.url());
    const consentRequestId = url.searchParams.get('CONSENT_REQUEST_ID');
    expect(consentRequestId).toBeTruthy();
    return consentRequestId;
  }

  async isGetAccountsVisible(): Promise<boolean> {
    return this.getAccountsButton.isVisible();
  }
}
