import { test, expect } from '../../src/fixtures/test-fixtures.js';
import { env } from '../../src/config/env.js';

test.describe('VRP Consent Flow', () => {
  test('should complete VRP consent creation from Hola through OBP-OIDC and OBP-Portal', async ({
    vrpFormPage,
    oidcLoginPage,
    confirmVrpConsentRequestPage,
    confirmVrpConsentPage,
    mainPage,
    page,
  }) => {
    await test.step('Navigate to Hola VRP form', async () => {
      await vrpFormPage.goto();
      await expect(page).toHaveURL(new RegExp('/index_obp_vrp'));
    });

    await test.step('Fill VRP form with test data', async () => {
      await vrpFormPage.fillVrpForm();
    });

    await test.step('Submit form and redirect to OBP-OIDC', async () => {
      await vrpFormPage.submit();
      // After submit, Hola creates consent request via OBP API,
      // then redirects to OBP-OIDC authorization endpoint
      await oidcLoginPage.waitForLoginPage();
    });

    await test.step('Authenticate on OBP-OIDC login page', async () => {
      await oidcLoginPage.login();
      // OBP-OIDC has no consent screen — after successful auth,
      // it redirects back with auth code, landing on OBP-Portal
    });

    await test.step('Confirm VRP consent request on OBP-Portal', async () => {
      await confirmVrpConsentRequestPage.waitForPage();
      await confirmVrpConsentRequestPage.verifyPageLoaded();

      const hasError = await confirmVrpConsentRequestPage.hasError();
      expect(hasError).toBe(false);

      // Confirming creates the consent and sends its OTP; older challenges in the mailbox must not be picked up.
      await confirmVrpConsentPage.ignoreEarlierOtpMail();
      await confirmVrpConsentRequestPage.confirmConsent();
    });

    let holaCallback = '';
    await test.step('Enter OTP to finalise consent', async () => {
      await confirmVrpConsentPage.waitForPage();
      await confirmVrpConsentPage.verifyPageLoaded();

      await confirmVrpConsentPage.enterOtpAndConfirm();
      holaCallback = await confirmVrpConsentPage.verifySuccess();
    });

    await test.step('Verify redirect back to Hola with ACCEPTED status', async () => {
      // Portal → OBP-OIDC → Hola's /main?consent_status=…&consent_id=… → /main
      await mainPage.waitForMainPage();
      await mainPage.verifyConsentAccepted(holaCallback);
    });
  });
});
