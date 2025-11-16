"use client";

import "@aws-amplify/ui-react/styles.css";
import {
  Authenticator,
  type AuthenticatorProps,
  Button,
  Heading,
  Text,
  View,
} from "@aws-amplify/ui-react";
import { Amplify } from "aws-amplify";
import Link from "next/link";
import amplifyOutputs from "../../../amplify_outputs.json";

Amplify.configure(amplifyOutputs, { ssr: true });

const formFields: AuthenticatorProps["formFields"] = {
  signIn: {
    username: {
      label: "Email address",
      placeholder: "you@example.com",
      type: "email",
      isRequired: true,
      autocomplete: "email",
    },
    password: {
      label: "Password",
      placeholder: "Enter your password",
      isRequired: true,
      autocomplete: "current-password",
    },
  },
  signUp: {
    email: {
      label: "Email address",
      placeholder: "you@example.com",
      isRequired: true,
    },
    password: {
      label: "Password",
      placeholder: "Choose a strong password",
      isRequired: true,
    },
    confirm_password: {
      label: "Confirm password",
      placeholder: "Re-type your password",
      isRequired: true,
    },
    phone_number: {
      label: "Mobile number",
      placeholder: "+1 202-555-0146",
      dialCode: "+1",
    },
  },
  confirmSignUp: {
    confirmation_code: {
      label: "Verification code",
      placeholder: "Enter the 6-digit code",
      isRequired: true,
    },
  },
  confirmSignIn: {
    confirmation_code: {
      label: "MFA verification code",
      placeholder: "123456",
      textAlign: "center",
    },
  },
  forgotPassword: {
    username: {
      label: "Email address",
      placeholder: "you@example.com",
    },
  },
  confirmForgotPassword: {
    confirmation_code: {
      label: "Reset code",
      placeholder: "123456",
    },
    password: {
      label: "New password",
      placeholder: "Enter a new password",
    },
  },
};

const components: AuthenticatorProps["components"] = {
  Header() {
    return (
      <View textAlign="center" padding="1.5rem 1.5rem 0">
        <Heading level={3}>Sign in to Safe Contracts</Heading>
        <Text variation="secondary">
          Multi-factor prompts automatically appear whenever your Cognito
          policies require them.
        </Text>
      </View>
    );
  },
  Footer() {
    return (
      <View textAlign="center" padding="0 1.5rem 1.5rem">
        <Text variation="tertiary">
          Having trouble? Reach out to your administrator for access.
        </Text>
      </View>
    );
  },
};

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <Authenticator
        loginMechanisms={["email"]}
        signUpAttributes={["email", "phone_number"]}
        formFields={formFields}
        components={components}
      >
        {({ user, signOut }) => (
          <View className="flex min-w-[320px] flex-col gap-4 rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-900">
            <Heading level={4}>Welcome back</Heading>
            <Text variation="secondary">
              Signed in as{" "}
              {user?.signInDetails?.loginId ?? user?.username ?? "unknown user"}
            </Text>
            <Button variation="primary" onClick={signOut}>
              Sign out
            </Button>
            <Link
              className="text-sm font-medium text-sky-600 no-underline hover:underline"
              href="/"
            >
              Continue to dashboard
            </Link>
          </View>
        )}
      </Authenticator>
    </div>
  );
}
