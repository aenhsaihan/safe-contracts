# Safe Contracts: Project Tribulations and Solutions

**A comprehensive guide documenting all challenges encountered during development and how they were resolved.**

---

## Table of Contents

1. [Overview](#overview)
2. [Phase 1: Initial Setup and Lambda Function URL](#phase-1-initial-setup-and-lambda-function-url)
3. [Phase 2: Authentication and Authorization](#phase-2-authentication-and-authorization)
4. [Phase 3: File Upload and Status Logic](#phase-3-file-upload-and-status-logic)
5. [Phase 4: File Download and Verification](#phase-4-file-download-and-verification)
6. [Phase 5: Amplify Hosting Deployment](#phase-5-amplify-hosting-deployment)
7. [Key Learnings and Best Practices](#key-learnings-and-best-practices)
8. [Future Development Guide](#future-development-guide)

---

## Overview

**Project**: Safe Contracts - A Next.js + AWS Amplify application for secure contract file exchange with KMS envelope encryption.

**Tech Stack**:
- Frontend: Next.js 16.0.3, React 19, TypeScript
- Backend: AWS Amplify Gen 2 (Auth, Data, Storage, Lambda, KMS)
- Infrastructure: Cognito, DynamoDB, S3, Lambda, KMS

**Timeline**: Multiple deployment cycles with various blockers that were systematically resolved.

---

## Phase 1: Initial Setup and Lambda Function URL

### Problem 1.1: Missing Lambda Function URL

**Symptom**: 
```
Error: Unable to resolve contracts function URL. Provide CONTRACTS_FUNCTION_URL or add it to amplify_outputs.json.
```

**Root Cause**: 
- Lambda function was not properly defined in Amplify backend
- Function URL was not exported to `amplify_outputs.json`

**Solution**:
1. Created `amplify/backend/functions/contractsFunction/resource.ts` to define the Lambda
2. Updated `amplify/backend.ts` to:
   - Import and include `contractsFunction` in backend definition
   - Attach IAM role with S3/KMS permissions
   - Set environment variables (bucket, KMS key, AppSync URL)
   - Add function URL with `FunctionUrlAuthType.NONE`
   - Export function URL to custom outputs

**Key Files**:
- `amplify/backend/functions/contractsFunction/resource.ts`
- `amplify/backend.ts`

**Lesson**: Always verify that Lambda functions are properly defined and their URLs are exported to `amplify_outputs.json`.

---

### Problem 1.2: Node.js Version Incompatibility

**Symptom**: 
- Amplify CLI errors during deployment
- Lambda runtime issues

**Root Cause**: 
- Local Node.js version (v25.1.0) incompatible with Amplify CLI
- Lambda needed Node.js 20 for stable `fetch()` API support

**Solution**:
1. Switched to Node.js 20 for local development (using `.nvmrc`)
2. Explicitly set Lambda runtime to Node.js 20 in `resource.ts`:
   ```typescript
   export const contractsFunction = defineFunction({
     name: 'contractsFunction',
     entry: './src/handler.ts',
     runtime: 20, // Node.js 20 for stable fetch() API support
   });
   ```

**Key Files**:
- `.nvmrc`
- `amplify/backend/functions/contractsFunction/resource.ts`

**Lesson**: Always match local Node.js version with Lambda runtime version.

---

### Problem 1.3: Amplify Gen 2 Bug - Missing Function URL in Outputs

**Symptom**: 
- Lambda deployed successfully
- Function URL not appearing in `amplify_outputs.json`

**Root Cause**: 
- Known Amplify Gen 2 v1.8.0 bug preventing automatic `amplify_outputs.json` generation

**Solution**:
1. Manually retrieved function URL from AWS Console
2. Added to `amplify_outputs.json` custom outputs
3. Committed `amplify_outputs.json` to repository (safe - contains endpoints, not secrets)

**Key Files**:
- `amplify_outputs.json`
- `get-function-url.sh` (helper script)

**Lesson**: Sometimes you need to work around Amplify bugs by manually updating outputs.

---

## Phase 2: Authentication and Authorization

### Problem 2.1: 403 Forbidden on Lambda Function URL

**Symptom**: 
```
contractsFunction invocation failed with 403 Forbidden: {"Message":null}
```

**Root Cause**: 
- Lambda Function URLs with `AuthType: NONE` require two permissions:
  1. `lambda:InvokeFunctionUrl`
  2. `lambda:InvokeFunction` with condition `StringEquals: lambda:InvokedViaFunctionUrl = true`
- Only the first permission was configured

**Solution** (After multiple attempts):
1. Added CORS headers to Lambda handler
2. Added both permissions in `amplify/backend.ts`:
   ```typescript
   lambdaFunction.addPermission("AllowPublicInvokeURL", {
     principal: new AnyPrincipal(),
     action: "lambda:InvokeFunctionUrl",
     functionUrlAuthType: FunctionUrlAuthType.NONE,
   });

   new CfnPermission(stack, "AllowPublicInvokeFunction", {
     functionName: lambdaFunction.functionName,
     principal: "*",
     action: "lambda:InvokeFunction",
   });
   ```
3. **Critical**: Updated `amplify_outputs.json` with the correct function URL (was using stale URL)

**Key Files**:
- `amplify/backend.ts`
- `amplify/backend/functions/contractsFunction/src/handler.ts`
- `amplify_outputs.json`

**Lesson**: Always verify you're using the correct function URL. Stale URLs can cause persistent 403 errors even with correct permissions.

---

### Problem 2.2: Unable to Resolve Authenticated User During Download

**Symptom**: 
```
500 Internal Server Error: {"error":"Unable to resolve authenticated user from the request."}
```

**Root Cause**: 
- `FunctionUrlAuthType.NONE` doesn't automatically parse Cognito JWT claims
- Lambda was trying to extract user ID from request context, but it wasn't available

**Solution**:
1. Updated `decryptAndDownload` to accept `userId` in payload
2. Modified server action to pass `currentUserId` explicitly:
   ```typescript
   return invokeContractsFunction({
     operation: "decryptAndDownload",
     payload: { fileId: input.fileId, userId: currentUserId },
   });
   ```
3. Updated Lambda handler to use `payload.userId` if available, falling back to request context

**Key Files**:
- `src/app/exchanges/[id]/actions.ts`
- `amplify/backend/functions/contractsFunction/src/handler.ts`
- `src/lib/amplify-server.ts`

**Lesson**: With `FunctionUrlAuthType.NONE`, you must explicitly pass authentication context in the payload.

---

## Phase 3: File Upload and Status Logic

### Problem 3.1: Files Uploaded but Not Visible in UI

**Symptom**: 
- Dashboard showed "COMPLETED" status
- Detail page showed "PENDING" and no files in "Encrypted files" section
- Files were successfully uploaded to S3

**Root Cause**: 
- Lambda was uploading to S3 but not creating `ContractFile` records in DynamoDB
- UI was querying DynamoDB for file metadata, which didn't exist

**Solution**:
1. Updated Lambda `encryptAndUpload` to return KMS metadata:
   - `kmsKeyId`
   - `kmsCiphertextKey`
   - Encryption context fields
2. Added `CREATE_CONTRACT_FILE` GraphQL mutation to `src/lib/contracts-data.ts`
3. Updated `uploadExchangeFileAction` to call `createContractFileRecord` after successful Lambda upload
4. Updated `ContractFileRecord` type to include KMS metadata

**Key Files**:
- `src/lib/contracts-data.ts`
- `src/app/exchanges/[id]/actions.ts`
- `amplify/backend/functions/contractsFunction/src/handler.ts`

**Lesson**: Always ensure metadata is persisted alongside file storage. S3 and DynamoDB must be kept in sync.

---

### Problem 3.2: Misleading Status Messages

**Symptom**: 
- Status showed "COMPLETED" after only one party uploaded
- Message said "All parties have uploaded" when only one had

**Root Cause**: 
- Status was being set to "COMPLETED" after any upload
- No check to verify both parties had uploaded

**Solution**:
1. Updated `uploadExchangeFileAction` to check if both parties have uploaded:
   ```typescript
   const allFiles = await listContractFilesForExchange(payload.exchangeId);
   const partyAFileIds = allFiles.filter((file) => file.ownerId === exchange.partyAId);
   const partyBFileIds = allFiles.filter((file) => file.ownerId === exchange.partyBId);
   
   const bothPartiesHaveUploaded = partyAFileIds.length > 0 && partyBFileIds.length > 0;
   
   if (bothPartiesHaveUploaded && exchange.status !== "COMPLETED") {
     await updateContractExchangeStatus({ id: exchange.id, status: "COMPLETED" });
   }
   ```
2. Updated status messages:
   - `COMPLETED`: "All parties have uploaded their executed copies."
   - `ACTION_REQUIRED`: "Waiting for the other party to upload their executed copy."
   - `PENDING`: "Exchange opened. Upload your executed copy to begin."

**Key Files**:
- `src/app/exchanges/[id]/actions.ts`
- `src/components/exchanges/ExchangeDetail.tsx`
- `src/app/exchanges/[id]/page.tsx`

**Lesson**: Always validate business logic conditions before updating status. Don't assume state based on single events.

---

### Problem 3.3: ReferenceError: isStatusUpdating is not defined

**Symptom**: 
```
ReferenceError: isStatusUpdating is not defined
```

**Root Cause**: 
- `useTransition` hook and `isStatusUpdating` were removed when status update logic moved to server action
- References to `isStatusUpdating` remained in JSX

**Solution**:
- Removed all references to `isStatusUpdating` from `UploadForm.tsx`
- Removed `useTransition` import

**Key Files**:
- `src/components/contracts/UploadForm.tsx`

**Lesson**: When refactoring, ensure all references to removed code are also removed.

---

## Phase 4: File Download and Verification

### Problem 4.1: Lambda Cannot Resolve AppSync Hostname

**Symptom**: 
```
500 Internal Server Error: {"error":"Failed to fetch ContractFile from GraphQL API: fetch failed. URL: https://fwzxnihat5a4hgjfwoyfbyjajq.appsync-api.ap-southeast-2.amazonaws.com/graphql"}
```

**Root Cause**: 
- Lambda's environment variable `SAFE_CONTRACTS_DATA_API_URL` had stale/incorrect AppSync API ID
- DNS resolution failure (`ENOTFOUND`)
- `backend.data.resources.graphqlApi.apiId` was returning wrong ID

**Solution**:
1. Hardcoded correct AppSync API ID in `amplify/backend.ts`:
   ```typescript
   const appsyncApiId = "2eqvg2d63fgkbprs4gql66vea4";
   cfnFunction.environment = {
     variables: {
       ...existingEnv,
       SAFE_CONTRACTS_DATA_API_URL: `https://${appsyncApiId}.appsync-api.${stack.region}.amazonaws.com/graphql`,
     },
   };
   ```
2. Added "Bearer " prefix to Authorization header when calling AppSync (required for Cognito User Pools)
3. Added extensive logging to diagnose fetch errors

**Key Files**:
- `amplify/backend.ts`
- `amplify/backend/functions/contractsFunction/src/handler.ts`

**Lesson**: Always verify environment variables match actual deployed resource IDs. Don't rely on Amplify's resource references if they're returning stale values.

---

## Phase 5: Amplify Hosting Deployment

### Problem 5.1: npm ERESOLVE Peer Dependency Conflict

**Symptom**: 
```
npm error ERESOLVE could not resolve
peer next@">=13.5.0 <16.0.0" from @aws-amplify/adapter-nextjs@1.6.11
Found: next@16.0.3
```

**Root Cause**: 
- `@aws-amplify/adapter-nextjs@1.6.11` doesn't support Next.js 16
- `npm ci` doesn't support `--legacy-peer-deps` flag
- Next.js auto-installs TypeScript without `--legacy-peer-deps`

**Solution** (After consulting Amazon Q):
1. Created `.npmrc` file with `legacy-peer-deps=true`:
   ```
   legacy-peer-deps=true
   ```
2. Updated `amplify.yml` to set npm config:
   ```yaml
   preBuild:
     commands:
       - npm config set legacy-peer-deps true
       - npm install --legacy-peer-deps
   ```

**Key Files**:
- `.npmrc`
- `amplify.yml`

**Lesson**: Use `.npmrc` to set npm defaults globally. This ensures all npm operations (including Next.js auto-installs) use the legacy peer deps setting.

---

### Problem 5.2: Build Hanging on File Check

**Symptom**: 
- Build log cuts off after executing `test -f amplify_outputs.json`
- Build never completes

**Root Cause**: 
- YAML parsing issues with colon characters in echo messages
- Command syntax causing build to hang

**Solution**:
- Removed the file check entirely (file exists in commit, check was unnecessary)
- Simplified `amplify.yml` to just run `npm install` and `npm run build`

**Key Files**:
- `amplify.yml`

**Lesson**: Keep build scripts simple. Unnecessary checks can cause more problems than they solve.

---

### Problem 5.3: Generic "Application error" at Runtime

**Symptom**: 
- Build succeeds
- Runtime shows generic "Application error: a server-side exception has occurred"
- No details in browser console

**Root Cause**: 
- Next.js error boundary not catching errors
- Missing error handling in server components
- Static generation conflicts with cookie usage

**Solution**:
1. Added Next.js error boundary (`src/app/error.tsx`)
2. Added `export const dynamic = "force-dynamic"` to pages using cookies:
   - `src/app/page.tsx`
   - `src/app/exchanges/[id]/page.tsx`
   - `src/app/exchanges/new/page.tsx`
3. Added `try-catch` blocks and detailed logging to:
   - `src/lib/contracts-config.ts` (amplify_outputs.json loading)
   - `src/app/page.tsx` (data loading)
   - `src/lib/contracts-data.ts` (GraphQL operations)
   - `src/app/exchanges/[id]/actions.ts` (upload actions)
4. Added `serverExternalPackages: []` to `next.config.ts`

**Key Files**:
- `src/app/error.tsx`
- `src/app/page.tsx`
- `src/app/exchanges/[id]/page.tsx`
- `src/app/exchanges/new/page.tsx`
- `src/lib/contracts-config.ts`
- `next.config.ts`

**Lesson**: Always add error boundaries and force dynamic rendering for pages using cookies or other dynamic features.

---

### Problem 5.4: Deployment Failures After Reverting Commits

**Symptom**: 
- Commit `bb455e7` failed deployment
- Revert commit also failed
- Force-push to working commit didn't trigger new deployment

**Root Cause**: 
- Amplify Hosting only deploys new commits, not reverted/old commits
- Need to create a new commit to trigger deployment

**Solution**:
1. Reset to working commit (`6335e9c`)
2. Created a new commit with a comment to trigger deployment
3. Eventually fixed the underlying issues and deployed successfully

**Key Files**:
- `README.md` (used for trigger commit)

**Lesson**: Amplify Hosting requires new commits to trigger deployments. Use trigger commits if you need to redeploy working code.

---

## Key Learnings and Best Practices

### 1. Lambda Function URLs
- With `AuthType.NONE`, you need both `lambda:InvokeFunctionUrl` and `lambda:InvokeFunction` permissions
- Always verify you're using the correct function URL (check for stale URLs)
- Pass authentication context explicitly in payloads

### 2. Amplify Gen 2
- Some features have bugs (function URL outputs)
- Resource references can return stale values
- Sometimes you need to hardcode resource IDs
- Always commit `amplify_outputs.json` for deployments

### 3. Next.js 16 + Amplify
- Use `force-dynamic` for pages with cookies
- Add error boundaries for better error visibility
- `.npmrc` is essential for peer dependency conflicts
- TypeScript auto-install respects `.npmrc` settings

### 4. Data Consistency
- Always persist metadata alongside file storage
- Keep S3 and DynamoDB in sync
- Validate business logic before updating status

### 5. Error Handling
- Add comprehensive logging to server actions
- Use try-catch blocks in server components
- Provide user-friendly error messages
- Log detailed context for debugging

---

## Future Development Guide

### For New Agents/Developers

#### 1. Understanding the Architecture

**Frontend**:
- Next.js 16 with App Router (React Server Components)
- Authentication via Amplify UI (`/signin` route)
- Server actions in `src/app/exchanges/[id]/actions.ts`
- Client components in `src/components/`

**Backend**:
- Amplify Gen 2 backend definitions in `amplify/backend.ts`
- Lambda handler in `amplify/backend/functions/contractsFunction/src/handler.ts`
- Data models in `amplify/data/resource.ts`
- IAM roles in `amplify/backend/iam/resource.ts`

**Key Files to Understand**:
- `src/lib/amplify-server.ts` - Server-side Amplify utilities
- `src/lib/contracts-data.ts` - GraphQL queries/mutations
- `src/lib/contracts-config.ts` - Configuration loading
- `amplify/backend.ts` - Backend infrastructure definition

#### 2. Local Development Setup

```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Start Amplify sandbox
npx ampx sandbox

# 3. Run Next.js dev server
npm run dev
```

**Important**: Always use Node.js 20 (check `.nvmrc`)

#### 3. Making Changes

**Frontend Changes**:
- Edit files in `src/`
- Server components auto-reload
- Server actions require page refresh

**Backend Changes**:
- Edit Lambda: `amplify/backend/functions/contractsFunction/src/handler.ts`
- Edit Data models: `amplify/data/resource.ts`
- Edit Infrastructure: `amplify/backend.ts`
- **Restart sandbox** after backend changes

#### 4. Deployment Checklist

Before deploying to Amplify Hosting:

- [ ] Verify `.npmrc` exists with `legacy-peer-deps=true`
- [ ] Check `amplify.yml` has correct build commands
- [ ] Ensure `amplify_outputs.json` is committed (or will be generated)
- [ ] Test locally with `npm run build`
- [ ] Verify all error boundaries are in place
- [ ] Check that pages using cookies have `force-dynamic` export

#### 5. Common Issues and Quick Fixes

**Issue**: 403 Forbidden on Lambda
- **Fix**: Check function URL in `amplify_outputs.json` matches deployed URL
- **Fix**: Verify both Lambda permissions are set (InvokeFunctionUrl + InvokeFunction)

**Issue**: "Unable to resolve authenticated user"
- **Fix**: Ensure `userId` is passed in Lambda payload
- **Fix**: Check Authorization header has "Bearer " prefix for AppSync calls

**Issue**: Files uploaded but not visible
- **Fix**: Verify `createContractFileRecord` is called after Lambda upload
- **Fix**: Check DynamoDB for ContractFile records

**Issue**: Build fails with peer dependency conflict
- **Fix**: Ensure `.npmrc` has `legacy-peer-deps=true`
- **Fix**: Check `amplify.yml` sets npm config

**Issue**: Generic "Application error" at runtime
- **Fix**: Add `force-dynamic` export to pages using cookies
- **Fix**: Check CloudWatch logs for actual error
- **Fix**: Verify `amplify_outputs.json` is accessible

#### 6. Debugging Tips

**CloudWatch Logs**:
- Lambda logs: `/aws/lambda/amplify-<app-name>-contractsFunctionlambdaF-<id>`
- Use `check-lambda-logs.sh` helper script

**Local Testing**:
- Use `./verify-credentials.sh` to check AWS credentials
- Use `./check-kms-deployment.sh` to verify KMS key exists
- Check browser console for client-side errors
- Check terminal for server-side errors

**Amplify Console**:
- Check build logs for deployment issues
- Verify environment variables are set
- Check backend environment association

#### 7. Important Configuration Files

- `.npmrc` - npm configuration (legacy-peer-deps)
- `amplify.yml` - Amplify Hosting build configuration
- `amplify_outputs.json` - Backend resource endpoints (committed)
- `next.config.ts` - Next.js configuration
- `.nvmrc` - Node.js version (20)

#### 8. Testing Workflow

1. **Create Exchange**: Sign in as Party A, create exchange with Party B's Cognito sub
2. **Upload as Party A**: Upload file, verify it appears in UI
3. **Sign in as Party B**: Verify exchange is visible
4. **Upload as Party B**: Upload file, verify status changes to COMPLETED
5. **Download**: Both parties should be able to download and verify files

#### 9. When Things Go Wrong

1. **Check CloudWatch Logs** - Most errors are logged there
2. **Verify amplify_outputs.json** - Ensure it has correct endpoints
3. **Check Function URL** - Verify it matches deployed Lambda
4. **Review Recent Changes** - What was the last thing that worked?
5. **Consult This Document** - Many issues are documented here
6. **Ask Amazon Q** - Formulate concise questions (max 1000 chars)

#### 10. Code Organization

**Server Actions**: `src/app/exchanges/[id]/actions.ts`
- `uploadExchangeFileAction` - Handles file uploads
- `downloadExchangeFileAction` - Handles file downloads

**Data Layer**: `src/lib/contracts-data.ts`
- GraphQL queries and mutations
- Helper functions for data access

**Amplify Utilities**: `src/lib/amplify-server.ts`
- `getCurrentUserServerSide` - Get authenticated user
- `invokeContractsFunction` - Call Lambda function URL

**Lambda Handler**: `amplify/backend/functions/contractsFunction/src/handler.ts`
- `encryptAndUpload` - Encrypt and upload to S3
- `decryptAndDownload` - Decrypt and download from S3

---

## Conclusion

This project encountered numerous challenges, but each was systematically resolved through:
1. Careful debugging and logging
2. Consulting AWS documentation and Amazon Q
3. Iterative problem-solving
4. Comprehensive error handling

The application is now fully functional with:
- ✅ Secure file uploads with KMS envelope encryption
- ✅ Multi-party file exchange
- ✅ Status tracking (PENDING → ACTION_REQUIRED → COMPLETED)
- ✅ File download and verification
- ✅ Successful Amplify Hosting deployment

**Key Takeaway**: Persistence, systematic debugging, and comprehensive error handling are essential for complex AWS deployments.

---

**Last Updated**: November 18, 2025
**Working Commit**: `7fe0ed2` (with `.npmrc` and `amplify.yml` fixes)
**Deployment Status**: ✅ Successfully deployed to Amplify Hosting

