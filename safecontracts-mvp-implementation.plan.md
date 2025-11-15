<!-- b7c0891b-120f-40b4-ae46-dcfa78e8bf22 bd3cfeee-413b-4214-9d50-3c14185ddf64 -->
# SafeContracts MVP Implementation Plan

## Phase 1: Project Setup & Infrastructure

### 1.1 Initialize Next.js Project

- Create Next.js 14 app with TypeScript, ESLint, Tailwind, App Router, src directory
- Install dependencies: `aws-amplify`, `@aws-amplify/ui-react`, `@aws-amplify/adapter-nextjs`
- Install AWS SDK v3: `@aws-sdk/client-kms`, `@aws-sdk/client-s3`
- Initialize Amplify Gen 2 with `npx create-amplify@latest` in root directory

### 1.2 Amplify Backend Resources

- [x] Create S3 bucket resource in `amplify/storage/resource.ts` with versioning enabled
- [x] Create KMS CMK with alias `alias/safe-contracts-master-key` in `amplify/backend/kms/resource.ts` (or via CDK)
- [x] Configure IAM permissions for Lambda function to access KMS and S3

## Phase 2: Data Models (Amplify Gen 2 Schema)

### 2.1 Define Schema in `amplify/data/resource.ts`

- **ContractExchange model**:
  - Fields: `id`, `title`, `partyAId`, `partyBId`, `createdById`, `status` (enum: PENDING/COMPLETED), `createdAt`, `updatedAt`
  - Relationship: `hasMany` ContractFile
  - Auth: Read by partyA/partyB/creator; Create/Update/Delete by owner/parties

- **ContractFile model**:
  - Fields: `id`, `exchangeId`, `ownerId`, `uploaderId`, `s3Key`, `fileName`, `fileSize`, `fileHash`, `kmsKeyId`, `kmsCiphertextKey`, `encryptionContextOwnerId`, `encryptionContextUploaderId`, `encryptionContextExchangeId`, `createdAt`, `updatedAt`
  - Relationship: `belongsTo` ContractExchange
  - Auth: Read by partyA/partyB of parent exchange; Delete by uploader/owner

## Phase 3: Lambda Function - Envelope Encryption

### 3.1 Create Function Structure

- Create `amplify/backend/functions/contractsFunction/` directory
- Set up Node.js 18+ runtime
- Install dependencies: `@aws-sdk/client-kms`, `@aws-sdk/client-s3`, `crypto` (built-in)

### 3.2 Implement Handler (`handler.ts`)

- **encryptAndUpload operation**:
  - Decode base64 file content
  - Compute SHA-256 hash of plaintext
  - Build encryption context (exchangeId, ownerId, uploaderId)
  - Call KMS `GenerateDataKeyCommand` with AES-256, encryption context
  - Encrypt file with AES-256-GCM using plaintext data key
  - Pack IV (12 bytes) + ciphertext + authTag (16 bytes) into single buffer
  - Upload to S3 with metadata (fileHash, kmsKeyId, kmsCiphertextKey base64, context fields)
  - Return fileId, s3Key, fileHash

- **decryptAndDownload operation**:
  - Look up ContractFile by fileId (via Amplify Data client)
  - Verify user authorization (partyA or partyB)
  - Download from S3
  - Extract IV, ciphertext, authTag from buffer
  - Rebuild encryption context from stored fields
  - Call KMS `DecryptCommand` with encrypted data key and context
  - Decrypt with AES-256-GCM
  - Verify hash matches stored fileHash
  - Return base64 plaintext, fileName, fileHash

### 3.3 IAM Permissions

- Grant function: `kms:GenerateDataKey`, `kms:Decrypt` (on CMK), `s3:PutObject`, `s3:GetObject` (on bucket)

## Phase 4: Authentication Setup

### 4.1 Amplify Auth Configuration

- Configure Cognito in `amplify/auth/resource.ts` with email/password, MFA enabled
- Set up user pool and identity pool

### 4.2 Auth Components

- Create `src/components/auth/Auth.tsx`:
  - Configure Amplify with `amplify_outputs.json`
  - Wrap with `Authenticator.Provider`
  - Use `runWithAmplifyServerContext` for SSR

- Create `src/components/layout/NavBar.tsx`:
  - Show Sign in/Sign out buttons
  - Links to Dashboard and New Exchange
  - Use server-side `getCurrentUser` to detect auth state

### 4.3 Auth Integration

- Update `app/layout.tsx` to wrap app with `<Auth>` provider
- Create `app/signin/page.tsx` with `<Authenticator />` component

## Phase 5: Server-Side Amplify Utilities

### 5.1 Create `src/lib/amplify-server.ts`

- Implement `runWithAmplifyServerContext` wrapper
- `getCurrentUserServerSide()` - get authenticated user
- `getDataClientServerSide()` - get typed Amplify Data client
- `invokeContractsFunction()` - typed function invoker

## Phase 6: Frontend Pages

### 6.1 Dashboard (`app/page.tsx`)

- Server component that fetches ContractExchanges where user is partyA or partyB
- Use `getDataClientServerSide()` to query with auth
- Display: title, parties, creation date, status
- Link to `/exchanges/[id]` for each exchange

### 6.2 Create Exchange (`app/exchanges/new/page.tsx`)

- Form with: title, partyBEmail (string input for MVP)
- Server action to create ContractExchange:
  - Set `partyAId` = current user's Cognito sub
  - Set `partyBId` = input string (MVP assumption)
  - Set `createdById` = partyAId
  - Status = "PENDING"

### 6.3 Exchange Detail (`app/exchanges/[id]/page.tsx`)

- Server component fetches exchange and related ContractFiles
- Display exchange info and file list (fileName, uploader, owner, date, hash snippet)
- Client component for upload form:
  - File input
  - Owner selection (My copy / Their copy)
  - Convert file to base64
  - Call `contractsFunction` with `encryptAndUpload`
  - Refresh data on success
- Download button for each file:
  - Call `contractsFunction` with `decryptAndDownload`
  - Convert base64 to Blob, trigger download
  - Optionally verify hash in browser

## Phase 7: UI Components

### 7.1 Create Component Files

- `src/components/exchanges/ExchangeList.tsx` - list view component
- `src/components/exchanges/ExchangeDetail.tsx` - detail view component
- `src/components/contracts/UploadForm.tsx` - file upload form
- Use Tailwind for styling, keep simple and readable

## Phase 8: Trust Indicators & UX

### 8.1 Add Trust Signals

- Show "File stored with KMS envelope encryption" on upload success
- Display hash snippet: `SHA-256: abcd1234...7890`
- On download: show "Integrity verified" or "Integrity FAILED" warning

## Phase 9: Documentation & Testing

### 9.1 Create README.md

- Explain envelope encryption architecture
- Local development: `npm run dev`, `npx amplify sandbox`
- Deployment via Amplify Hosting
- Architecture diagram (text-based)

### 9.2 Create Test Script

- `scripts/test-encryption.ts`:
  - Sample base64 content
  - Round-trip: encrypt → S3 → decrypt → verify hash

## Phase 10: File Structure

```
safe_contracts/
├── app/
│   ├── layout.tsx
│   ├── page.tsx (dashboard)
│   ├── signin/
│   │   └── page.tsx
│   └── exchanges/
│       ├── new/
│       │   └── page.tsx
│       └── [id]/
│           └── page.tsx
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   └── Auth.tsx
│   │   ├── layout/
│   │   │   └── NavBar.tsx
│   │   ├── exchanges/
│   │   │   ├── ExchangeList.tsx
│   │   │   └── ExchangeDetail.tsx
│   │   └── contracts/
│   │       └── UploadForm.tsx
│   └── lib/
│       ├── amplify-server.ts
│       └── crypto-utils.ts (IV/ciphertext/authTag packing helpers)
├── amplify/
│   ├── data/
│   │   └── resource.ts
│   ├── auth/
│   │   └── resource.ts
│   ├── storage/
│   │   └── resource.ts
│   └── backend/
│       ├── functions/
│       │   └── contractsFunction/
│       │       ├── handler.ts
│       │       └── package.json
│       └── kms/
│           └── resource.ts (or CDK)
├── scripts/
│   └── test-encryption.ts
└── README.md
```

## Implementation Notes

- **MVP Assumptions**:
  - `partyBId` accepts string input (no email → user resolution yet)
  - Owner selection in upload form defaults to current user
  - File format: 12-byte IV + ciphertext + 16-byte authTag concatenated
  - Encryption: AES-256-GCM with KMS-generated data keys

- **Security**:
  - All files encrypted with unique data keys
  - Data keys encrypted with CMK (never leave KMS)
  - Encryption context binds keys to exchange/parties
  - Hash verification on download prevents tampering

- **Type Safety**:
  - Use Amplify Gen 2 generated types throughout
  - TypeScript strict mode enabled
  - Typed function invocations

### To-dos

- [x] Initialize Next.js 14 project with TypeScript, Tailwind, App Router, and install Amplify dependencies
- [x] Create S3 bucket resource with versioning enabled (Phase 1.2)
- [x] Create KMS CMK resource with alias `alias/safe-contracts-master-key` (Phase 1.2)
- [x] Configure IAM permissions for Lambda function (Phase 1.2 - complete)
- [ ] Define ContractExchange and ContractFile models in amplify/data/resource.ts with relationships and auth rules
- [ ] Create contractsFunction Lambda with encryptAndUpload and decryptAndDownload operations using KMS envelope encryption
- [ ] Configure Cognito auth, create Auth component wrapper, NavBar, and signin page
- [ ] Create src/lib/amplify-server.ts with server-side helpers for auth, data client, and function invocation
- [ ] Implement dashboard page (app/page.tsx) to list user's contract exchanges
- [ ] Implement /exchanges/new page with form to create new contract exchanges
- [ ] Implement /exchanges/[id] page with file list, upload form, and download functionality
- [ ] Create reusable UI components (ExchangeList, ExchangeDetail, UploadForm) with Tailwind styling
- [ ] Add trust signals (encryption status, hash display, integrity verification messages) to UI
- [ ] Create README.md with architecture explanation, setup instructions, and test script for encryption round-trip
