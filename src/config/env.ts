import dotenv from 'dotenv';

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

export const env = {
  // Base URLs
  HOLA_BASE_URL: optional('HOLA_BASE_URL', 'http://localhost:8087'),
  OBP_PORTAL_BASE_URL: optional('OBP_PORTAL_BASE_URL', 'http://localhost:5174'),
  API_MANAGER_BASE_URL: optional('API_MANAGER_BASE_URL', 'http://localhost:3003'),

  // OIDC software identifier — picked on the API Manager login page
  // (e.g. "obp-oidc"). This selects WHICH OIDC provider implementation to delegate to.
  OIDC_LOGIN_PROVIDER: optional('OIDC_LOGIN_PROVIDER', 'obp-oidc'),

  // OBP-OIDC login credentials (optional — only needed by tests that use default login)
  OBP_LOGIN_USERNAME: optional('OBP_LOGIN_USERNAME', ''),
  OBP_LOGIN_PASSWORD: optional('OBP_LOGIN_PASSWORD', ''),

  // VRP form: bank & account routing (optional — only needed by VRP tests)
  VRP_FROM_BANK_ROUTING_ADDRESS: optional('VRP_FROM_BANK_ROUTING_ADDRESS', ''),
  VRP_FROM_ROUTING_ADDRESS: optional('VRP_FROM_ROUTING_ADDRESS', ''),
  VRP_TO_ROUTING_ADDRESS: optional('VRP_TO_ROUTING_ADDRESS', ''),
  VRP_CURRENCY: optional('VRP_CURRENCY', 'EUR'),

  // VRP form: limits
  VRP_MAX_SINGLE_AMOUNT: optional('VRP_MAX_SINGLE_AMOUNT', '100'),
  VRP_MAX_MONTHLY_AMOUNT: optional('VRP_MAX_MONTHLY_AMOUNT', '1000'),
  VRP_MAX_MONTHLY_FREQUENCY: optional('VRP_MAX_MONTHLY_FREQUENCY', '10'),
  VRP_MAX_YEARLY_AMOUNT: optional('VRP_MAX_YEARLY_AMOUNT', '10000'),
  VRP_MAX_YEARLY_FREQUENCY: optional('VRP_MAX_YEARLY_FREQUENCY', '100'),
  VRP_MAX_NUMBER_OF_HISTORICAL_CONSENTS_SHOWN: optional('VRP_MAX_NUMBER_OF_HISTORICAL_CONSENTS_SHOWN', '10'),

  // Powerful user credentials (has entitlements to create banks, grant entitlements, etc.)
  POWERFUL_USER_1_USERNAME: optional('POWERFUL_USER_1_USERNAME', 'TheSuperUserAForTesting'),
  POWERFUL_USER_1_PASSWORD: optional('POWERFUL_USER_1_PASSWORD', ''),
  // Credentials provider — picked from the dropdown on the OBP-OIDC login page.
  // Identifies WHERE this user's credentials are stored (e.g. an OBP-API host URL).
  POWERFUL_USER_1_CREDENTIALS_PROVIDER: optional('POWERFUL_USER_1_CREDENTIALS_PROVIDER', 'obp-oidc'),

  // Credentials provider for users the tests register via Portal /register.
  // Portal creates them in OBP-API, so this is the OBP-API host as it appears
  // in the OBP-OIDC provider dropdown (matched as a case-insensitive substring).
  REGISTERED_USER_CREDENTIALS_PROVIDER: optional('REGISTERED_USER_CREDENTIALS_PROVIDER', 'http://127.0.0.1:8080'),

  // Mailpit (email testing)
  MAILPIT_API_URL: optional('MAILPIT_API_URL', 'http://localhost:8025'),

  // OTP
  TEST_OTP_VALUE: optional('TEST_OTP_VALUE', ''),
};
