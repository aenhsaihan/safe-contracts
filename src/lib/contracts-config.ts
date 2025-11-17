// Import amplify_outputs.json - Next.js handles JSON imports automatically
// In production, the file should be in the build output
// Using try-catch with detailed logging to help diagnose issues
let amplifyOutputsJson: any;

try {
  // Standard ES6 import - Next.js handles this automatically
  amplifyOutputsJson = require("../../amplify_outputs.json");
} catch (requireError: any) {
  // Fallback: try reading from filesystem (for production builds)
  try {
    const fs = require("fs");
    const path = require("path");
    const configPath = path.join(process.cwd(), "amplify_outputs.json");
    console.log("[contracts-config] Trying to load from:", configPath);
    if (fs.existsSync(configPath)) {
      amplifyOutputsJson = JSON.parse(fs.readFileSync(configPath, "utf8"));
      console.log("[contracts-config] ✓ Loaded from filesystem");
    } else {
      console.error("[contracts-config] ✗ File not found at:", configPath);
      console.error("[contracts-config] Current working directory:", process.cwd());
      throw new Error(`amplify_outputs.json not found at ${configPath}. Require error: ${requireError?.message || requireError}`);
    }
  } catch (fsError: any) {
    const errorMsg = `Failed to load amplify_outputs.json. Require: ${requireError?.message || requireError}, FS: ${fsError?.message || fsError}`;
    console.error("[contracts-config] FATAL ERROR:", errorMsg);
    throw new Error(errorMsg);
  }
}

// Validate that we got valid config
if (!amplifyOutputsJson || typeof amplifyOutputsJson !== "object") {
  const errorMsg = "amplify_outputs.json is invalid or empty";
  console.error("[contracts-config] FATAL ERROR:", errorMsg);
  throw new Error(errorMsg);
}

console.log("[contracts-config] ✓ Successfully loaded amplify_outputs.json");

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
