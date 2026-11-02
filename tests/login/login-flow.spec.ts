import { test, expect } from '../../src/fixtures/test-fixtures.js';
import { env, idp } from '../../src/config/env.js';

test.describe('Login Flow (OBP-OIDC)', () => {
  test('Powerful User 1 can log in to API Manager via OBP-OIDC', async ({
    apiManagerLoginPage,
    oidcLoginPage,
    page,
  }) => {
    await test.step('Navigate to API Manager login and pick OBP-OIDC provider', async () => {
      console.log('Before navigating to API Manager login and picking OBP-OIDC provider');
      await apiManagerLoginPage.goto();
      console.log(`After navigating to API Manager login. URL is now: ${page.url()}`);
    });

    await test.step('Wait for OBP-OIDC login page', async () => {
      console.log('Before waiting for OBP-OIDC login page');
      await oidcLoginPage.waitForLoginPage();
      console.log(`After waiting for OBP-OIDC login page. URL is now: ${page.url()}`);
    });

    await test.step('Submit credentials for Powerful User 1', async () => {
      console.log('Before submitting credentials for Powerful User 1');
      console.log(`   username: ${env.POWERFUL_USER_1_USERNAME || '(empty!)'}`);
      console.log(`   password: ${env.POWERFUL_USER_1_PASSWORD ? '(set, ' + env.POWERFUL_USER_1_PASSWORD.length + ' chars)' : '(empty!)'}`);
      console.log(`   provider: ${env.POWERFUL_USER_1_CREDENTIALS_PROVIDER || '(empty!)'}`);
      await oidcLoginPage.login(
        env.POWERFUL_USER_1_USERNAME,
        env.POWERFUL_USER_1_PASSWORD,
        env.POWERFUL_USER_1_CREDENTIALS_PROVIDER,
      );
      console.log(`After submitting credentials. URL is now: ${page.url()}`);
    });

    await test.step('Verify redirect away from the IdP login page', async () => {
      console.log('Before verifying redirect away from the IdP login page');
      await expect(page).not.toHaveURL(idp.loginPage);
      expect(page.url()).toContain(env.API_MANAGER_BASE_URL);
      console.log('After verifying redirect. Logged in successfully');
    });
  });
});
