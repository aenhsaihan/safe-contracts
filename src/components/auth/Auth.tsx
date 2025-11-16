"use client";

import { Authenticator } from "@aws-amplify/ui-react";
import { Amplify } from "aws-amplify";
import { ReactNode } from "react";
import amplifyOutputs from "../../../amplify_outputs.json";

Amplify.configure(amplifyOutputs, { ssr: true });

type AuthProps = {
  children: ReactNode;
};

export function Auth({ children }: AuthProps) {
  return <Authenticator.Provider>{children}</Authenticator.Provider>;
}
