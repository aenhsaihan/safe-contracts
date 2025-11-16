import { Amplify } from "aws-amplify";

import { amplifyOutputs } from "./contracts-config";

let configured = false;

export function ensureAmplifyConfigured() {
  if (!configured) {
    Amplify.configure(amplifyOutputs, { ssr: true });
    configured = true;
  }
}
