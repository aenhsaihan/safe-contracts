import amplifyOutputsJson from "../../amplify_outputs.json";

export type ContractsAmplifyOutputs = typeof amplifyOutputsJson & {
  functions?: {
    contractsFunction?: {
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

export const amplifyOutputs = amplifyOutputsJson as ContractsAmplifyOutputs;

export function resolveContractsFunctionUrl() {
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
