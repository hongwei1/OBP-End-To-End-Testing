import { observeMutations } from '../helpers/MutationLedger.js';
import { allowedRequest } from '../config/safety.js';
import { test as base } from '@playwright/test';
import { VrpFormPage } from '../pages/hola/VrpFormPage.js';
import { MainPage } from '../pages/hola/MainPage.js';
import { OidcLoginPage } from '../pages/obp-oidc/OidcLoginPage.js';
import { LoginPage } from '../pages/portal/LoginPage.js';
import { ConfirmVrpConsentRequestPage } from '../pages/portal/ConfirmVrpConsentRequestPage.js';
import { ConfirmVrpConsentPage } from '../pages/portal/ConfirmVrpConsentPage.js';
import { RegisterPage } from '../pages/portal/RegisterPage.js';
import { ApiManagerLoginPage } from '../pages/api-manager/ApiManagerLoginPage.js';
import { MetricsPage } from '../pages/api-manager/MetricsPage.js';
import { ProfilePage } from '../pages/api-manager/ProfilePage.js';
import { CreateEntitlementPage } from '../pages/api-manager/CreateEntitlementPage.js';
import { CreateBankPage } from '../pages/api-manager/CreateBankPage.js';
import { DynamicEntityCreatePage } from '../pages/api-manager/DynamicEntityCreatePage.js';
import { DynamicEntitiesListPage } from '../pages/api-manager/DynamicEntitiesListPage.js';
import { DynamicEntityDetailPage } from '../pages/api-manager/DynamicEntityDetailPage.js';
import { DynamicEntityCrudPage } from '../pages/api-manager/DynamicEntityCrudPage.js';
import { EmailValidationPage } from '../pages/portal/EmailValidationPage.js';
import { ForgotPasswordPage } from '../pages/portal/ForgotPasswordPage.js';
import { ResetPasswordPage } from '../pages/portal/ResetPasswordPage.js';
import { MailpitClient } from '../helpers/MailpitClient.js';

type TestFixtures = {
  vrpFormPage: VrpFormPage;
  mainPage: MainPage;
  oidcLoginPage: OidcLoginPage;
  portalLoginPage: LoginPage;
  confirmVrpConsentRequestPage: ConfirmVrpConsentRequestPage;
  confirmVrpConsentPage: ConfirmVrpConsentPage;
  registerPage: RegisterPage;
  apiManagerLoginPage: ApiManagerLoginPage;
  metricsPage: MetricsPage;
  profilePage: ProfilePage;
  createEntitlementPage: CreateEntitlementPage;
  createBankPage: CreateBankPage;
  dynamicEntityCreatePage: DynamicEntityCreatePage;
  dynamicEntitiesListPage: DynamicEntitiesListPage;
  dynamicEntityDetailPage: DynamicEntityDetailPage;
  dynamicEntityCrudPage: DynamicEntityCrudPage;
  emailValidationPage: EmailValidationPage;
  forgotPasswordPage: ForgotPasswordPage;
  resetPasswordPage: ResetPasswordPage;
  mailpit: MailpitClient;
};

export const test = base.extend<TestFixtures>({
  browser: async ({ browser }, use) => {
    const original = browser.newContext.bind(browser);
    const drains: Array<() => Promise<void>> = [];
    browser.newContext = async (...args) => {
      const context = await original(...args);
      await context.route('**/*', async route => {
        if (allowedRequest(route.request().url())) await route.continue();
        else await route.abort('blockedbyclient');
      });
      drains.push(observeMutations(context));
      return context;
    };
    try { await use(browser); } finally {
      browser.newContext = original;
      for (const drain of drains) await drain();
    }
  },
  vrpFormPage: async ({ page }, use) => {
    await use(new VrpFormPage(page));
  },
  mainPage: async ({ page }, use) => {
    await use(new MainPage(page));
  },
  oidcLoginPage: async ({ page }, use) => {
    await use(new OidcLoginPage(page));
  },
  portalLoginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  confirmVrpConsentRequestPage: async ({ page }, use) => {
    await use(new ConfirmVrpConsentRequestPage(page));
  },
  confirmVrpConsentPage: async ({ page }, use) => {
    await use(new ConfirmVrpConsentPage(page));
  },
  registerPage: async ({ page }, use) => {
    await use(new RegisterPage(page));
  },
  apiManagerLoginPage: async ({ page }, use) => {
    await use(new ApiManagerLoginPage(page));
  },
  metricsPage: async ({ page }, use) => {
    await use(new MetricsPage(page));
  },
  profilePage: async ({ page }, use) => {
    await use(new ProfilePage(page));
  },
  createEntitlementPage: async ({ page }, use) => {
    await use(new CreateEntitlementPage(page));
  },
  createBankPage: async ({ page }, use) => {
    await use(new CreateBankPage(page));
  },
  dynamicEntityCreatePage: async ({ page }, use) => {
    await use(new DynamicEntityCreatePage(page));
  },
  dynamicEntitiesListPage: async ({ page }, use) => {
    await use(new DynamicEntitiesListPage(page));
  },
  dynamicEntityDetailPage: async ({ page }, use) => {
    await use(new DynamicEntityDetailPage(page));
  },
  dynamicEntityCrudPage: async ({ page }, use) => {
    await use(new DynamicEntityCrudPage(page));
  },
  emailValidationPage: async ({ page }, use) => {
    await use(new EmailValidationPage(page));
  },
  forgotPasswordPage: async ({ page }, use) => {
    await use(new ForgotPasswordPage(page));
  },
  resetPasswordPage: async ({ page }, use) => {
    await use(new ResetPasswordPage(page));
  },
  mailpit: async ({}, use) => {
    await use(new MailpitClient());
  },
});

export { expect } from '@playwright/test';
