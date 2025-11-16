import { createServerRunner, type NextServer } from "@aws-amplify/adapter-nextjs";
import type { AmplifyServer } from "aws-amplify/adapter-core/internals";
import { getCurrentUser, fetchAuthSession } from "aws-amplify/auth/server";
import { generateClient } from "aws-amplify/data";
import type { AWSAmplifyBackendOutputs } from "@aws-amplify/client-config";
import { cookies } from "next/headers";

import type { Schema } from "../../amplify/data/resource";
import amplifyOutputsJson from "../../amplify_outputs.json";

/**
 * Narrow the generated outputs with custom function fields so TypeScript can
 * infer the location of the contracts function URL regardless of where it is stored.
 */
type ContractsAmplifyOutputs = AWSAmplifyBackendOutputs & {
  functions?: {
    contractsFunction?: {
      /**
       * Amplify does not currently emit a strongly-typed shape for functions, so we
       * look for a reasonable set of property names.
       */
      functionUrl?: string;
      url?: string;
      endpoint?: string;
      name?: string;
      region?: string;
    };
  };
  custom?: {
    contractsFunctionUrl?: string;
    [key: string]: unknown;
  };
};

const amplifyOutputs = amplifyOutputsJson as ContractsAmplifyOutputs;

const {
  runWithAmplifyServerContext: runWithAmplifyServerContextBase,
} = createServerRunner({ config: amplifyOutputs });

const dataClient = generateClient<Schema>({ config: amplifyOutputs });

type RunWithAmplifyServerContextInput<Result> = {
  nextServerContext?: NextServer.Context | null;
  operation: (contextSpec: AmplifyServer.ContextSpec) => Result | Promise<Result>;
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
 */
export async function getCurrentUserServerSide() {
  return runWithAmplifyServerContext((contextSpec) => getCurrentUser(contextSpec));
}

/**
 * Provides a singleton Amplify Data client wired up with the generated schema.
 * Consumers should invoke client APIs inside `runWithAmplifyServerContext`.
 */
export function getDataClientServerSide() {
  return dataClient;
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
    };
  };
  decryptAndDownload: {
    input: {
      fileId: string;
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

function resolveContractsFunctionUrl() {
  const fromEnv = process.env.CONTRACTS_FUNCTION_URL;
  const fromCustom = amplifyOutputs.custom?.contractsFunctionUrl;
  const fromFunctions =
    amplifyOutputs.functions?.contractsFunction?.functionUrl ??
    amplifyOutputs.functions?.contractsFunction?.url ??
    amplifyOutputs.functions?.contractsFunction?.endpoint;

  const url = fromEnv ?? fromCustom ?? fromFunctions;

  if (!url) {
    throw new Error(
      "Unable to resolve contracts function URL. Provide CONTRACTS_FUNCTION_URL or add it to amplify_outputs.json."
    );
  }

  return url;
}

/**
 * Invokes the `contractsFunction` Lambda with strong typing around its operations.
 */
export async function invokeContractsFunction<Operation extends ContractsFunctionOperation>({
  operation,
  payload,
}: {
  operation: Operation;
  payload: ContractsFunctionOperationMap[Operation]["input"];
}): Promise<ContractsFunctionOperationMap[Operation]["output"]> {
  const contractsFunctionUrl = resolveContractsFunctionUrl();

  const { tokens } = await runWithAmplifyServerContext((contextSpec) =>
    fetchAuthSession(contextSpec)
  );
  const authorization = tokens?.idToken?.toString() ?? tokens?.accessToken?.toString();

  const response = await fetch(contractsFunctionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify({
      operation,
      payload,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
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
