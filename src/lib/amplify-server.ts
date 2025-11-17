import {
  createServerRunner,
  type NextServer,
} from "@aws-amplify/adapter-nextjs";
import { generateServerClientUsingCookies } from "@aws-amplify/adapter-nextjs/api";
import type { AmplifyServer } from "aws-amplify/adapter-core/internals";
import { getCurrentUser, fetchAuthSession } from "aws-amplify/auth/server";
import { cookies } from "next/headers";

import {
  amplifyOutputs,
  resolveContractsFunctionUrl,
} from "./contracts-config";

const { runWithAmplifyServerContext: runWithAmplifyServerContextBase } =
  createServerRunner({ config: amplifyOutputs });

// Note: Data client should be generated inside server context operations
// We'll generate it lazily when needed

type RunWithAmplifyServerContextInput<Result> = {
  nextServerContext?: NextServer.Context | null;
  operation: (
    contextSpec: AmplifyServer.ContextSpec
  ) => Result | Promise<Result>;
};

/**
 * Ensures every Amplify server-side call receives the correct Next.js context (cookies
 * for App Router server components by default).
 */
export function runWithAmplifyServerContext<Result>({
  nextServerContext,
  operation,
}: RunWithAmplifyServerContextInput<Result>) {
  return runWithAmplifyServerContextBase({
    nextServerContext: nextServerContext ?? { cookies },
    operation,
  });
}

/**
 * Returns the signed-in Cognito user within a server component or action.
 * Returns null if auth is not configured or user is not signed in.
 */
export async function getCurrentUserServerSide() {
  try {
    return await runWithAmplifyServerContext({
      operation: (contextSpec) => getCurrentUser(contextSpec),
    });
  } catch (error) {
    // If auth is not configured or user is not signed in, return null
    // This allows pages to load even when auth isn't fully set up
    if (
      error instanceof Error &&
      (error.message.includes("not configured") ||
        error.message.includes("UserPool") ||
        error.message.includes("No current user"))
    ) {
      return null;
    }
    // Re-throw other errors
    throw error;
  }
}

/**
 * Provides an Amplify Data client wired up with the generated schema.
 * Uses generateServerClientUsingCookies for proper server-side context.
 */
export function getDataClientServerSide() {
  // Use generateServerClientUsingCookies for server-side usage
  // This properly handles the Next.js server context
  const client = generateServerClientUsingCookies({
    config: amplifyOutputs,
    cookies,
  });
  return client;
}

export type ContractsFunctionOperationMap = {
  encryptAndUpload: {
    input: {
      exchangeId: string;
      ownerId: string;
      uploaderId: string;
      fileName: string;
      fileSize: number;
      /**
       * Base64-encoded contents of the file selected by the user.
       */
      fileBase64: string;
    };
    output: {
      fileId: string;
      s3Key: string;
      fileHash: string;
      kmsKeyId: string;
      kmsCiphertextKey: string;
      encryptionContextOwnerId: string;
      encryptionContextUploaderId: string;
      encryptionContextExchangeId: string;
    };
  };
  decryptAndDownload: {
    input: {
      fileId: string;
      userId?: string;
    };
    output: {
      fileName: string;
      fileHash: string;
      /**
       * Base64 payload that can be converted back into a Blob client-side.
       */
      fileBase64: string;
    };
  };
};

type ContractsFunctionOperation = keyof ContractsFunctionOperationMap;

/**
 * Invokes the `contractsFunction` Lambda with strong typing around its operations.
 */
export async function invokeContractsFunction<
  Operation extends ContractsFunctionOperation,
>({
  operation,
  payload,
}: {
  operation: Operation;
  payload: ContractsFunctionOperationMap[Operation]["input"];
}): Promise<ContractsFunctionOperationMap[Operation]["output"]> {
  const contractsFunctionUrl = resolveContractsFunctionUrl();

  const { tokens } = await runWithAmplifyServerContext({
    operation: (contextSpec) => fetchAuthSession(contextSpec),
  });
  // Send token directly without Bearer prefix for FunctionUrlAuthType.NONE
  // The function URL doesn't validate tokens, so we just pass it through
  const authorization =
    tokens?.idToken?.toString() ?? tokens?.accessToken?.toString();

  const requestBody = JSON.stringify({
    operation,
    payload,
  });

  console.log(
    "[invokeContractsFunction] Calling function URL:",
    contractsFunctionUrl
  );
  console.log(
    "[invokeContractsFunction] Has authorization token:",
    !!authorization
  );
  console.log(
    "[invokeContractsFunction] Request body size:",
    requestBody.length
  );

  const response = await fetch(contractsFunctionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: requestBody,
  });

  console.log(
    "[invokeContractsFunction] Response status:",
    response.status,
    response.statusText
  );
  console.log(
    "[invokeContractsFunction] Response headers:",
    Object.fromEntries(response.headers.entries())
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[invokeContractsFunction] Error response body:", errorBody);
    throw new Error(
      `contractsFunction invocation failed with ${response.status} ${response.statusText}: ${errorBody}`
    );
  }

  const json = (await response.json()) as {
    result?: ContractsFunctionOperationMap[Operation]["output"];
    error?: string;
  };

  if (json.error) {
    throw new Error(json.error);
  }

  if (!json.result) {
    throw new Error("contractsFunction response missing result payload.");
  }

  return json.result;
}
