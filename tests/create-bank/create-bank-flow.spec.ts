import { test, expect } from '../../src/fixtures/test-fixtures.js';
import { env } from '../../src/config/env.js';

// OBP accepts a BANK_ID of at most 16 characters (APIUtil.checkShortString), so the suffix is 6 base-36 characters.
function generateUniqueBankId() {
  const suffix = Math.floor(Math.random() * 36 ** 6).toString(36).padStart(6, '0');
  return `test-bank-${suffix}`;
}

test.describe('Create Bank Flow (OBP-OIDC)', () => {
  test('should log in as Powerful User 1 and create a bank via API Manager', async ({
    apiManagerLoginPage,
    oidcLoginPage,
    createBankPage,
  }) => {
    const bankId = generateUniqueBankId();
    const bankName = `Test Bank ${bankId}`;

    await test.step('Log in to API Manager as Powerful User 1', async () => {
      await apiManagerLoginPage.goto();
      await oidcLoginPage.waitForLoginPage();
      await oidcLoginPage.login(
        env.POWERFUL_USER_1_USERNAME,
        env.POWERFUL_USER_1_PASSWORD,
        env.POWERFUL_USER_1_CREDENTIALS_PROVIDER,
      );
    });

    await test.step('Navigate to create bank page', async () => {
      await createBankPage.goto();
    });

    await test.step('Fill in bank details and submit', async () => {
      await createBankPage.fillForm(bankId, bankName);
      await createBankPage.submit();
    });

    await test.step('Verify redirect to bank detail page', async () => {
      await createBankPage.verifyRedirectToBankDetail(bankId);
    });
  });

  test('should show OBP error when bank_id is too short', async ({
    apiManagerLoginPage,
    oidcLoginPage,
    createBankPage,
  }) => {
    await test.step('Log in to API Manager as Powerful User 1', async () => {
      await apiManagerLoginPage.goto();
      await oidcLoginPage.waitForLoginPage();
      await oidcLoginPage.login(
        env.POWERFUL_USER_1_USERNAME,
        env.POWERFUL_USER_1_PASSWORD,
        env.POWERFUL_USER_1_CREDENTIALS_PROVIDER,
      );
    });

    await test.step('Navigate to create bank page', async () => {
      await createBankPage.goto();
    });

    await test.step('Submit with a 2-character bank_id', async () => {
      await createBankPage.fillForm('ab', 'Test Bank Short ID');
      await createBankPage.submit();
    });

    await test.step('Verify OBP validation error about bank_id length', async () => {
      const errorMessage = await createBankPage.getErrorToastMessage();
      expect(errorMessage).toContain('OBP-10001');
      expect(errorMessage).toContain('Min length of BANK_ID should be greater than 3 characters');
    });
  });
});
