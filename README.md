## SafeContracts

<!-- Deployment trigger: Restored to working commit 6335e9c -->

SafeContracts is a Next.js + AWS Amplify application that lets two parties exchange contracts that are stored with envelope encryption. The frontend is rendered with the App Router (React Server Components) and the backend stack is provisioned with Amplify Gen 2 (auth, data, storage, Lambda, and KMS).

---

## Envelope Encryption Architecture

SafeContracts uses a standard envelope encryption workflow so that plaintext files never leave the Lambda runtime:

1. **Upload (encryptAndUpload)**
   1. Browser converts the selected file to Base64 and sends it to the `contractsFunction` Lambda.
   2. Lambda calls `GenerateDataKey` on the dedicated CMK (`alias/safe-contracts-master-key`) with an encryption context derived from the exchange ID, owner ID, and uploader ID.
   3. The plaintext data key encrypts the file with AES-256-GCM; IV + ciphertext + auth tag are packed together (`src/lib/crypto-utils.ts`).
   4. Lambda uploads the ciphertext blob to the private S3 bucket and persists metadata (hash, encrypted data key, context) to the `ContractFile` model. Only the ciphertext key ever leaves the function.

2. **Download (decryptAndDownload)**
   1. A user requests a file and Lambda fetches the `ContractFile` record to confirm they are party A/B and retrieve the stored metadata.
   2. The ciphertext object is downloaded from S3, unpacked into IV/ciphertext/auth tag, and the encrypted data key is submitted to `Decrypt` with the original encryption context.
   3. The recovered plaintext data key decrypts the file; Lambda recomputes the SHA-256 hash and returns the Base64 payload to the browser if it matches.

`ContractExchange` and `ContractFile` schemas live in `amplify/data/resource.ts`, while shared server helpers (Amplify Auth/Data clients, Lambda invoker) live in `src/lib/amplify-server.ts`.

---

## Text-Based Architecture Diagram

```
Browser (Next.js App Router + Amplify Auth)
        |
        | HTTPS (signed-in user, ID/Access token)
        v
Next.js Server Components / Actions (runWithAmplifyServerContext)
        |
        | invokeContractsFunction()
        v
Amplify contractsFunction (Node 18 Lambda)
        | \_____________________________________________
        |                                               |
        v                                               v
AWS KMS CMK (alias/safe-contracts-master-key)      Amazon S3 Private Bucket
  - GenerateDataKey / Decrypt                        - Stores IV|ciphertext|authTag blobs
        |
        v
Amplify Data (ContractExchange / ContractFile metadata)
```

---

## Repository Structure Highlights

- `src/` – Next.js App Router code, Amplify-aware server utilities, and UI components.
- `amplify/` – Gen 2 backend definitions (Auth, Data models, Storage, Lambda, IAM, and the custom KMS key).
- `amplify/backend/functions/contractsFunction` – Lambda handler responsible for envelope encryption, S3 I/O, and metadata persistence.
- `scripts/` & `*.sh` – Helper scripts for verifying AWS credentials, running Amplify sandbox environments, and validating the KMS deployment.
- `.nvmrc` – Locks development to Node.js 20, matching Lambda and Amplify requirements.

---

## Local Development Workflow

1. **Prerequisites**
   - Node.js 20 (`nvm use` will read `.nvmrc`; `./setup-node20.sh` installs prerequisites if needed).
   - AWS CLI credentials with access to Amplify, CloudFormation, KMS, and S3 in your target region (default `ap-southeast-2`).
   - Amplify Gen 2 CLI (`npm install -g @aws-amplify/cli` or run via `npx ampx`).

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the Amplify sandbox backend**

   ```bash
   # Option A: direct CLI
   export AWS_PROFILE=<your-profile>    # or rely on default credentials
   npx ampx sandbox --profile <your-profile>

   # Option B: helper script (wraps the above command)
   ./run-amplify-sandbox.sh
   ```

   - The sandbox deploys Cognito auth, the DynamoDB-backed data API, S3 bucket, contracts Lambda, and the dedicated KMS CMK.
   - On first run Amplify may bootstrap the region (see `BOOTSTRAP-AWS.md`).
   - When the deployment finishes, Amplify generates/updates `amplify_outputs.json`, which Next.js imports to configure the client and server adapters.

4. **Run the Next.js dev server**

   ```bash
   npm run dev
   ```

   - Visit `http://localhost:3000`.
   - Use the `/signin` route (Amplify UI) to authenticate. Signed-in requests automatically forward the correct cookies/tokens to Amplify via `runWithAmplifyServerContext`.

5. **Iterate**
   - Frontend code reloads automatically.
   - Lambda and data schema edits require restarting the sandbox so Amplify can redeploy the backend.

6. **Troubleshooting**
   - `./verify-credentials.sh` checks that AWS credentials can call STS.
   - `./check-kms-deployment.sh` and `verify-kms-deployment.md` outline how to confirm the CMK/alias exist.
   - If `invokeContractsFunction` throws “Unable to resolve contracts function URL,” verify that the sandbox outputs include the function URL or set `CONTRACTS_FUNCTION_URL` locally.

### Counterparty identifiers (Cognito sub)

When creating a new exchange in the UI you must provide the counterparty's Cognito **sub** (the UUID shown in the Amplify Auth user list). Email aliases are not persisted anywhere in the `ContractExchange` model, so copy the exact `sub` string from the Cognito console or from `getCurrentUser()` of your second test account when you paste it into the "Counterparty identifier" field.

---

## Deployment via Amplify Hosting

1. **Push code to your Git provider** (GitHub, GitLab, Bitbucket). Ensure `amplify_outputs.json` is committed or that your CI environment has access to the Amplify backend outputs.

2. **Provision a long-lived Amplify backend environment**

   ```bash
   npx ampx deploy --branch main --profile <prod-profile>
   ```

   This promotes the sandbox configuration (Auth, Data, Lambda, KMS, S3) into a named environment that Amplify Hosting can reference.

3. **Create an Amplify Hosting app**
   - In the AWS Console, open Amplify Hosting → “New app” → “Host web app”.
   - Connect the repository and choose the branch to deploy.

4. **Configure build settings**
   - Default build commands:
     ```yaml
     preBuild:
       commands:
         - npm ci
     build:
       commands:
         - npx ampx pull --appId <amplify-app-id> --envName <env> --yes
         - npm run build
     ```
   - The `ampx pull` step downloads the environment-specific `amplify_outputs.json` used during SSR.

5. **Environment variables**
   - Set `CONTRACTS_FUNCTION_URL` (if not emitted in outputs), any custom analytics keys, and the target `AWS_REGION`.
   - Provide the Amplify app ID and environment name so Hosting can fetch backend artifacts automatically.

6. **Deploy and verify**
   - Amplify will provision hosting (CloudFront + S3) and run the build.
   - After the build succeeds, open the preview URL to smoke-test uploads/downloads. Verify that files stored in S3 match the metadata in the ContractFile table and that the Lambda can reach the KMS key (watch CloudWatch logs if something fails).

---

## Reference

- **Frontend runtime**: Next.js 16 (React 19) with Amplify Auth/UI components.
- **Backend services**: Amplify Auth (Cognito), Amplify Data (DynamoDB), contractsFunction Lambda, private S3 bucket, dedicated KMS CMK, IAM roles scoped to `GenerateDataKey`, `Decrypt`, `PutObject`, and `GetObject`.
- **Data models**: `ContractExchange` (tracks parties and status) and `ContractFile` (stores metadata required for envelope encryption and file integrity).
- **Crypto conventions**: AES-256-GCM with 12-byte IV, 16-byte auth tag, Base64-encoded encrypted data key stored alongside the ciphertext, SHA-256 integrity hashing.

With these pieces wired together you can iterate locally using `npm run dev` + `npx ampx sandbox`, keep backend resources in sync, and ship the application through Amplify Hosting for production.
