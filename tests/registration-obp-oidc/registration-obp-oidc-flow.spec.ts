import { test, expect } from '../../src/fixtures/test-fixtures.js';
import { env, idp } from '../../src/config/env.js';
import { ApiManagerLoginPage } from '../../src/pages/api-manager/ApiManagerLoginPage.js';
import { OidcLoginPage } from '../../src/pages/obp-oidc/OidcLoginPage.js';
import { ProfilePage } from '../../src/pages/api-manager/ProfilePage.js';
import { UserDetailPage } from '../../src/pages/api-manager/UserDetailPage.js';

const PROVIDER = env.REGISTERED_USER_CREDENTIALS_PROVIDER;

function generateUniqueUser() {
  const suffix = `${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
  return {
    firstName: 'Test',
    lastName: 'User',
    email: `testuser_${suffix}@example.com`,
    username: `testuser_${suffix}`,
    password: 'Test@12345!secure',
  };
}

// OBP-OIDC only authenticates users whose email has been validated
// (HybridAuthService queries v_oidc_users WHERE validated = true), so every
// successful login below goes through the Mailpit validation step first.
test.describe('Registration and Login Flow (OBP-OIDC)', () => {
  test('should register, validate email via Mailpit, and log in', async ({
    registerPage,
    emailValidationPage,
    oidcLoginPage,
    mailpit,
  }) => {
    const user = generateUniqueUser();

    await test.step('Clear Mailpit inbox', async () => {
      await mailpit.deleteAllMessages();
    });

    await test.step('Register a new user on OBP Portal', async () => {
      await registerPage.goto();
      await registerPage.fillRegistrationForm(user);
      await registerPage.acceptLegalDocuments();
      await registerPage.submit();
      await registerPage.verifySuccess();
    });

    await test.step('Retrieve validation email from Mailpit and validate', async () => {
      const message = await mailpit.waitForMessage(`to:${user.email}`);
      const token = mailpit.extractValidationToken(message.HTML || message.Text);
      await emailValidationPage.validateToken(token);
      await emailValidationPage.verifySuccess();
    });

    await test.step('Log in on OBP Portal with validated credentials', async () => {
      await emailValidationPage.goToLogin();
      // Portal auto-redirects to OBP-OIDC login page (single provider)
      await oidcLoginPage.waitForLoginPage();
      await oidcLoginPage.login(user.username, user.password, PROVIDER);
    });
  });

  test('should not allow login before the email is validated', async ({
    registerPage,
    portalLoginPage,
    oidcLoginPage,
  }) => {
    const user = generateUniqueUser();

    await test.step('Register a new user on OBP Portal', async () => {
      await registerPage.goto();
      await registerPage.fillRegistrationForm(user);
      await registerPage.acceptLegalDocuments();
      await registerPage.submit();
      await registerPage.verifySuccess();
    });

    await test.step('Attempt login without validating the email', async () => {
      await portalLoginPage.goto();
      await oidcLoginPage.waitForLoginPage();
      const error = await oidcLoginPage.loginExpectingFailure(user.username, user.password, PROVIDER);
      expect(error).toContain(idp.failedLoginText);
    });
  });

  test('should fail to log in with wrong password', async ({
    registerPage,
    emailValidationPage,
    portalLoginPage,
    oidcLoginPage,
    mailpit,
  }) => {
    const user = generateUniqueUser();

    await test.step('Clear Mailpit inbox', async () => {
      await mailpit.deleteAllMessages();
    });

    await test.step('Register and validate a new user', async () => {
      await registerPage.goto();
      await registerPage.fillRegistrationForm(user);
      await registerPage.acceptLegalDocuments();
      await registerPage.submit();
      await registerPage.verifySuccess();

      const message = await mailpit.waitForMessage(`to:${user.email}`);
      const token = mailpit.extractValidationToken(message.HTML || message.Text);
      await emailValidationPage.validateToken(token);
      await emailValidationPage.verifySuccess();
    });

    await test.step('Attempt login with wrong password', async () => {
      await portalLoginPage.goto();
      await oidcLoginPage.waitForLoginPage();
      const error = await oidcLoginPage.loginExpectingFailure(user.username, 'WrongPassword!999', PROVIDER);
      expect(error).toContain(idp.failedLoginText);
    });
  });

  test('should register with a mobile phone number and store it on the user', async ({
    registerPage,
    emailValidationPage,
    mailpit,
    browser,
  }) => {
    const user = { ...generateUniqueUser(), mobilePhoneNumber: '+44 7700 900123' };

    await test.step('Clear Mailpit inbox', async () => {
      await mailpit.deleteAllMessages();
    });

    await test.step('Register with a mobile phone number and validate the email', async () => {
      await registerPage.goto();
      await registerPage.fillRegistrationForm(user);
      await registerPage.acceptLegalDocuments();
      await registerPage.submit();
      await registerPage.verifySuccess();

      const message = await mailpit.waitForMessage(`to:${user.email}`);
      const token = mailpit.extractValidationToken(message.HTML || message.Text);
      await emailValidationPage.validateToken(token);
      await emailValidationPage.verifySuccess();
    });

    // The new user's own API Manager profile exposes the user_id ...
    let userId: string | null = null;
    const userContext = await browser.newContext();
    const userPage = await userContext.newPage();
    await test.step('New user logs in to API Manager and captures user_id', async () => {
      const apiManagerLogin = new ApiManagerLoginPage(userPage);
      const oidcLogin = new OidcLoginPage(userPage);
      const profilePage = new ProfilePage(userPage);

      await apiManagerLogin.goto();
      await oidcLogin.waitForLoginPage();
      await oidcLogin.login(user.username, user.password, PROVIDER);

      await profilePage.goto();
      await profilePage.waitForPage();
      await profilePage.waitForUsername(user.username);
      userId = await profilePage.getUserId();
      expect(userId).toBeTruthy();
    });
    await userContext.close();

    // ... and the admin user detail page (v7.0.0 GET /users/user-id/{id}) shows the number.
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await test.step('Powerful User 1 sees the mobile phone number on the user record', async () => {
      const apiManagerLogin = new ApiManagerLoginPage(adminPage);
      const oidcLogin = new OidcLoginPage(adminPage);
      const userDetailPage = new UserDetailPage(adminPage);

      await apiManagerLogin.goto();
      await oidcLogin.waitForLoginPage();
      await oidcLogin.login(
        env.POWERFUL_USER_1_USERNAME,
        env.POWERFUL_USER_1_PASSWORD,
        env.POWERFUL_USER_1_CREDENTIALS_PROVIDER,
      );

      await userDetailPage.goto(userId!);
      expect(await userDetailPage.getMobilePhoneNumber()).toBe(user.mobilePhoneNumber);
      // Registration stores the number but does not verify it.
      expect(await userDetailPage.getMobilePhoneValidated()).toBe('No');
    });
    await adminContext.close();
  });

  test('should not submit a malformed mobile phone number', async ({ registerPage, page }) => {
    const user = { ...generateUniqueUser(), mobilePhoneNumber: 'not-a-phone-number' };

    await test.step('Fill the form with an invalid mobile phone number', async () => {
      await registerPage.goto();
      await registerPage.fillRegistrationForm(user);
      await registerPage.acceptLegalDocuments();
    });

    await test.step('Browser validation blocks the submit', async () => {
      expect(await registerPage.isMobilePhoneNumberRejectedByBrowser()).toBe(true);
      await registerPage.submit();
      // Still on the form: no navigation to /register/success
      await expect(page).toHaveURL(/\/register$/);
    });
  });
});
