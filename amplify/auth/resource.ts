import { defineAuth } from '@aws-amplify/backend';

/**
 * Configure Cognito with email/password sign-in, MFA, and the generated user
 * and identity pools that back the application.
 */
export const auth = defineAuth({
  name: 'SafeContractsAuth',
  loginWith: {
    email: true,
  },
  userAttributes: {
    email: {
      required: true,
      mutable: false,
    },
  },
  accountRecovery: 'EMAIL_ONLY',
  multifactor: {
    mode: 'OPTIONAL', // Changed to OPTIONAL for testing - users can skip MFA
    sms: true,
    totp: true,
  },
});
