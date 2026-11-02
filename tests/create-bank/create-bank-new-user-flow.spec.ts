import { test, expect } from '../../src/fixtures/test-fixtures.js';
import { env } from '../../src/config/env.js';
import { OidcLoginPage } from '../../src/pages/obp-oidc/OidcLoginPage.js';
import { ApiManagerLoginPage } from '../../src/pages/api-manager/ApiManagerLoginPage.js';
import { CreateEntitlementPage } from '../../src/pages/api-manager/CreateEntitlementPage.js';
import { CreateBankPage } from '../../src/pages/api-manager/CreateBankPage.js';

function generateUniqueUser() {
  const suffix = `${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
  return {
    firstName: 'Test',
    lastName: 'BankCreator',
    email: `testbank_${suffix}@example.com`,
    username: `testbank_${suffix}`,
    password: 'Test@12345!secure',
  };
}

// OBP accepts a BANK_ID of at most 16 characters (APIUtil.checkShortString), so the suffix is 6 base-36 characters.
function generateUniqueBankId() {
  const suffix = Math.floor(Math.random() * 36 ** 6).toString(36).padStart(6, '0');
  return `test-bank-${suffix}`;
}

test.describe('Create Bank - New User Flow (OBP-OIDC)', () => {
  test('new user registers, gets CanCreateBank from Powerful User 1, then creates a bank', async ({
    registerPage,
    emailValidationPage,
    mailpit,
    browser,
  }) => {
    const user = generateUniqueUser();
    const bankId = generateUniqueBankId();
    const bankName = `Test Bank ${bankId}`;

    // ── Step 1: Register and validate new user ──────────────────
    await test.step('Register and validate new user via email', async () => {
      await mailpit.deleteAllMessages();
      await registerPage.goto();
      await registerPage.fillRegistrationForm(user);
      await registerPage.acceptLegalDocuments();
      await registerPage.submit();
      await registerPage.verifySuccess();

      const validationEmail = await mailpit.waitForMessage(`to:${user.email}`);
      const token = mailpit.extractValidationToken(validationEmail.HTML || validationEmail.Text);
      await emailValidationPage.validateToken(token);
      await emailValidationPage.verifySuccess();
    });

    // ── Step 2: Powerful User 1 grants CanCreateBank to new user ────
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();

    await test.step('Powerful User 1 logs in to API Manager', async () => {
      const adminLogin = new ApiManagerLoginPage(adminPage);
      const adminOidc = new OidcLoginPage(adminPage);

      await adminLogin.goto();
      await adminOidc.waitForLoginPage();
      await adminOidc.login(
        env.POWERFUL_USER_1_USERNAME,
        env.POWERFUL_USER_1_PASSWORD,
        env.POWERFUL_USER_1_CREDENTIALS_PROVIDER,
      );
    });

    await test.step('Powerful User 1 grants CanCreateBank to new user', async () => {
      const createEntitlementPage = new CreateEntitlementPage(adminPage);

      await createEntitlementPage.goto();
      await createEntitlementPage.searchAndSelectUser(user.username);

      const isSelected = await createEntitlementPage.isUserSelected();
      expect(isSelected).toBe(true);

      await createEntitlementPage.searchAndSelectRole('CanCreateBank');
      await createEntitlementPage.submit();
      await createEntitlementPage.verifySuccess();
    });

    await adminContext.close();

    // ── Step 3: New user logs in to API Manager and creates bank ─
    const userContext = await browser.newContext();
    const userPage = await userContext.newPage();

    await test.step('New user logs in to API Manager', async () => {
      const userLogin = new ApiManagerLoginPage(userPage);
      const userOidc = new OidcLoginPage(userPage);

      await userLogin.goto();
      await userOidc.waitForLoginPage();
      await userOidc.login(user.username, user.password, env.REGISTERED_USER_CREDENTIALS_PROVIDER);
    });

    await test.step('New user creates a bank', async () => {
      const createBankPage = new CreateBankPage(userPage);

      await createBankPage.goto();
      await createBankPage.fillForm(bankId, bankName);
      await createBankPage.submit();
      await createBankPage.verifyRedirectToBankDetail(bankId);
    });

    await userContext.close();
  });
});
