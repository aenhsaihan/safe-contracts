import { runWithAmplifyServerContext } from "@aws-amplify/adapter-nextjs";
import { Authenticator } from "@aws-amplify/ui-react";
import { fetchAuthSession } from "aws-amplify/auth";
import { Amplify } from "aws-amplify";
import { cookies } from "next/headers";
import { ReactNode } from "react";
import amplifyOutputs from "../../../amplify_outputs.json";

Amplify.configure(amplifyOutputs, { ssr: true });

type AuthProps = {
  children: ReactNode;
};

export async function Auth({ children }: AuthProps) {
  await runWithAmplifyServerContext({
    nextServerContext: { cookies },
    operation: async (contextSpec) => {
      await fetchAuthSession(contextSpec);
    },
  });

  return <Authenticator.Provider>{children}</Authenticator.Provider>;
}
