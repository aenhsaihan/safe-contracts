# Manual UX Testing Guide for SafeContracts

This guide walks you through testing the SafeContracts application as a regular user would experience it.

## Prerequisites

1. **Node.js 20** - Ensure you're using Node 20 (check with `node --version`)
2. **AWS Credentials** - Your `.env` file should have valid AWS credentials
3. **Dependencies Installed** - Run `npm install` if you haven't already

## Post-Development Issues and Solutions

After completing the initial development, we encountered several issues when trying to run the application. This section documents those issues, why they occurred, how we fixed them, and how to avoid them in the future.

### Issue 1: Build Error - `runWithAmplifyServerContext` Import Error

**Problem:**
```
Export runWithAmplifyServerContext doesn't exist in target module
```

**Why it happened:**
- The `Auth.tsx` component was trying to import `runWithAmplifyServerContext` directly from `@aws-amplify/adapter-nextjs`
- However, this export doesn't exist in that package - it needs to be imported from our own wrapper module

**How we fixed it:**
- Changed the import in `src/components/auth/Auth.tsx` from:
  ```typescript
  import { runWithAmplifyServerContext } from "@aws-amplify/adapter-nextjs";
  ```
- To:
  ```typescript
  import { runWithAmplifyServerContext } from "@/lib/amplify-server";
  ```
- Our `amplify-server.ts` module wraps `createServerRunner` and exports `runWithAmplifyServerContext`

**How to avoid:**
- Always import `runWithAmplifyServerContext` from `@/lib/amplify-server`, not directly from Amplify packages
- Use the centralized server-side utilities in `src/lib/amplify-server.ts`

---

### Issue 2: Runtime Error - `createContext` Only Works in Client Components

**Problem:**
```
createContext only works in Client Components. Add the "use client" directive
```

**Why it happened:**
- The `Auth.tsx` component was using `Authenticator.Provider` which uses React's `createContext`
- `createContext` is a client-side API and cannot be used in Server Components
- Next.js App Router components are Server Components by default

**How we fixed it:**
- Added `"use client"` directive at the top of `src/components/auth/Auth.tsx`
- Removed server-side code (`runWithAmplifyServerContext`) from the client component
- Simplified the component to only wrap children with `Authenticator.Provider`

**How to avoid:**
- Always add `"use client"` to components that use:
  - React Context (`createContext`, `useContext`)
  - Browser APIs (`localStorage`, `window`, etc.)
  - Event handlers (`onClick`, `onChange`, etc.)
  - State hooks (`useState`, `useEffect`, etc.)
- Keep server-side logic in Server Components or Server Actions

---

### Issue 3: Runtime Error - `operation is not a function`

**Problem:**
```
TypeError: operation is not a function
```

**Why it happened:**
- Multiple places in the codebase were calling `runWithAmplifyServerContext` with a function directly:
  ```typescript
  runWithAmplifyServerContext((contextSpec) => getCurrentUser(contextSpec))
  ```
- But `runWithAmplifyServerContext` expects an object with an `operation` property:
  ```typescript
  runWithAmplifyServerContext({ operation: (contextSpec) => ... })
  ```

**How we fixed it:**
- Updated all calls to use the correct object syntax:
  ```typescript
  // ❌ Wrong
  runWithAmplifyServerContext((contextSpec) => getCurrentUser(contextSpec))
  
  // ✅ Correct
  runWithAmplifyServerContext({
    operation: (contextSpec) => getCurrentUser(contextSpec),
  })
  ```
- Fixed in:
  - `src/lib/amplify-server.ts` - `getCurrentUserServerSide()` and `invokeContractsFunction()`
  - `src/app/exchanges/new/page.tsx` - `createExchangeAction()`

**How to avoid:**
- Always use the object syntax: `{ operation: ... }` when calling `runWithAmplifyServerContext`
- Check the function signature before using it
- Use TypeScript types to catch these errors at compile time

---

### Issue 4: Amplify Gen 2 Output Generation Bug (ZodError)

**Problem:**
```
Amplify outputs could not be generated. [ZodError]
- AWS::Amplify::Platform - expected object, received string
- AWS::Amplify::GraphQL - expected object, received string
- AWS::Amplify::Auth - expected object, received string
```

**Why it happened:**
- This is a **known bug in Amplify Gen 2 v1.8.0**
- The sandbox deployment succeeds, but output generation fails when reading CloudFormation stack outputs
- Amplify's output generator expects objects but receives strings from CloudFormation
- This happens even without custom `CfnOutput` statements (we tested removing all of them)

**How we fixed it:**
1. **Manual `amplify_outputs.json` creation:**
   - Got Cognito User Pool details from AWS Console:
     - User Pool ID: `ap-southeast-2_fRmaieSLe`
     - App Client ID: `2t4vc8odv54p96ciluhj5bcv4s`
   - Got AppSync endpoint from sandbox terminal output
   - Manually created `amplify_outputs.json` with correct values

2. **Added multiple auth field formats for compatibility:**
   ```json
   {
     "auth": {
       "userPoolId": "...",
       "webClientId": "...",
       "aws_user_pools_id": "...",
       "aws_user_pools_web_client_id": "...",
       "Cognito": { ... }
     }
   }
   ```

3. **Added graceful error handling:**
   - Updated `getCurrentUserServerSide()` to catch auth config errors
   - Returns `null` instead of throwing, allowing pages to load

**How to avoid:**
- **Short-term:** Manually create `amplify_outputs.json` if output generation fails
- **Long-term:** 
  - Report the bug to AWS Amplify team (GitHub issues or support ticket)
  - Monitor Amplify CLI updates for fixes
  - Consider using environment variables as a workaround
  - Keep error handling in place to gracefully handle missing auth config

**Workaround Steps (if you encounter this):**
1. Deploy succeeds but `amplify_outputs.json` is empty or missing
2. Go to AWS Console → Cognito → User Pools
3. Find your User Pool and note:
   - User Pool ID
   - App Client ID (from "App integration" → "App clients")
4. Get AppSync endpoint from sandbox terminal output
5. Manually create `amplify_outputs.json` using the template in `FIX_AMPLIFY_OUTPUTS.md`
6. Add error handling to server-side auth calls

---

### Issue 5: Runtime Error - "Auth UserPool not configured"

**Problem:**
```
Runtime AuthUserPoolException: Auth UserPool not configured
```

**Why it happened:**
- Even after manually creating `amplify_outputs.json`, the server-side code was still throwing errors
- The auth configuration format might not match what Amplify Gen 2 expects
- Server-side `getCurrentUser()` was being called before auth was properly configured

**How we fixed it:**
1. **Added multiple auth field formats** to `amplify_outputs.json` for compatibility
2. **Added error handling** in `getCurrentUserServerSide()`:
   ```typescript
   try {
     return await runWithAmplifyServerContext({
       operation: (contextSpec) => getCurrentUser(contextSpec),
     });
   } catch (error) {
     if (error.message.includes("not configured") || 
         error.message.includes("UserPool")) {
       return null; // Gracefully handle missing auth config
     }
     throw error;
   }
   ```
3. This allows pages to load even if auth isn't fully configured (shows as "not signed in")

**How to avoid:**
- Always add error handling for auth operations in server components
- Don't assume auth is always configured - handle the null case
- Test with and without auth configuration
- Use TypeScript to make auth state explicit (nullable types)

---

### Issue 6: Runtime Error - `Cannot read properties of undefined (reading 'list')`

**Problem:**
```
TypeError: Cannot read properties of undefined (reading 'list')
```

**Why it happened:**
- We relied on `dataClient.models.ContractExchange.list(...)` and similar helpers
- Those helpers are only generated when `amplify_outputs.json` contains the `data.model_introspection` block produced by `defineData`
- Because of the Amplify Gen 2 Zod bug (see Issue 4), our manually created outputs never included `model_introspection`
- As a result, `dataClient.models` was `undefined`, so any attempt to read `.list` or `.create` exploded during SSR

**How we fixed it:**
1. Added `src/lib/contracts-data.ts` with raw GraphQL documents for all operations we need (list exchanges, list files, create exchange)
2. Updated the dashboard, exchange detail page, and new exchange form to call those helpers instead of `client.models.*`
3. Left authentication/session handling to `getDataClientServerSide()`, but no longer depend on missing schema metadata

**How to avoid:**
- Don’t assume `client.models` exists unless you can verify `model_introspection` is present in your outputs
- Prefer concentring all raw GraphQL calls in a single helper so signatures and auth handling stay consistent
- If Amplify ever regenerates the outputs correctly, you can migrate back—but keep the raw queries as a fallback

---

### Issue 7: Runtime Error - `Body must be a string. Received: undefined.`

**Problem:**
```
Error: Body must be a string. Received: undefined.
```

**Why it happened:**
- After switching to raw GraphQL queries we still called `client.graphql(contextSpec, { query, variables })`
- That signature is for the request/response client (`generateServerClientUsingReqRes`), not the cookie-based client we use (`generateServerClientUsingCookies`)
- Passing the server `contextSpec` object as the first argument caused the GraphQL engine to treat it as the “query body”, producing the error above

**How we fixed it:**
1. Updated `executeGraphQL` to call the cookie client correctly: `(await client.graphql({ query, variables }))`
2. Removed the extra `runWithAmplifyServerContext` wrapper for these operations—the cookie client already injects cookies automatically
3. Kept the helper typed so we still get compile-time checking on the response payloads

**How to avoid:**
- Remember the two call signatures:
  - Cookie client → `client.graphql({ query, variables })`
  - Req/res client → `client.graphql(contextSpec, { query, variables })`
- Wrap all GraphQL calls in one helper (`executeGraphQL`) so the correct signature lives in one place
- If you switch client types later, you only need to update that helper

---

## Summary of Lessons Learned

1. **Import paths matter:** Always use centralized utility modules, not direct package imports
2. **Client vs Server Components:** Understand Next.js App Router component types
3. **API signatures:** Always check function signatures and use correct parameter formats
4. **Amplify Gen 2 bugs:** Be aware of known issues and have workarounds ready
5. **Error handling:** Always add graceful error handling, especially for auth operations
6. **Manual configuration:** Sometimes manual config files are necessary when tooling fails

---

## Step 1: Start the Backend (Amplify Sandbox)

The backend provides:
- Cognito authentication
- DynamoDB (via Amplify Data)
- S3 bucket for encrypted files
- KMS key for envelope encryption
- Lambda function for encryption/decryption

**Start the sandbox:**

```bash
# Option A: Use the helper script
./run-amplify-sandbox.sh

# Option B: Manual command
export $(cat .env | grep -v '^#' | xargs)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20
npx ampx sandbox
```

**What to expect:**
- The sandbox will deploy all backend resources
- It will generate/update `amplify_outputs.json`
- Wait for the message indicating deployment is complete
- Keep this terminal running (don't close it)

**Verification:**
- Check that `amplify_outputs.json` exists and has content
- Look for "Deployment complete" or similar message in the terminal

## Step 2: Start the Frontend (Next.js Dev Server)

In a **new terminal window** (keep the sandbox running):

```bash
cd /Users/anar_enhsaihan/Documents/playground/amazon/safe_contracts

# Ensure Node 20
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20

# Start the dev server
npm run dev
```

**What to expect:**
- Server starts on `http://localhost:3000`
- You should see "Ready" message
- Open your browser to `http://localhost:3000`

## Step 3: User Flow Testing

### 3.1 Initial Visit (Not Signed In)

**What you should see:**
- NavBar at the top with "Safe Contracts" branding
- "Sign in" button in the top right
- Dashboard page showing:
  - "Sign in to see encrypted exchanges you're a participant in"
  - "Start a new exchange" button (may redirect to sign-in)

**Test:**
- Click "Sign in" button → Should navigate to `/signin`

### 3.2 Sign Up / Sign In

**Navigate to:** `http://localhost:3000/signin`

**What you should see:**
- Amplify Authenticator UI
- Sign in form with email and password fields
- Link to "Create account" if you don't have one

**Test Sign Up (First Time):**
1. Click "Create account"
2. Enter:
   - Email address (use a real email you can access)
   - Password (must meet Cognito requirements)
   - Confirm password
   - Phone number (optional, but MFA is enabled)
3. Submit the form
4. **Check your email** for verification code
5. Enter verification code
6. If MFA is required, you'll get an SMS code or TOTP prompt
7. Complete MFA verification

**Test Sign In (Subsequent Visits):**
1. Enter your email and password
2. Complete MFA if required
3. You should be redirected to the dashboard

**What to expect after sign-in:**
- NavBar shows your username/userId
- "Sign out" button appears
- Dashboard shows your exchanges (empty if first time)

### 3.3 Create a New Exchange

**Navigate to:** Click "New Exchange" in NavBar or go to `http://localhost:3000/exchanges/new`

**What you should see:**
- Form with two fields:
  - Exchange title (e.g., "Series A Subscription Agreement")
  - Counterparty identifier (e.g., another user's email or Cognito sub)

**Test:**
1. Enter a title: "Test Contract Exchange"
2. Enter counterparty: Use another email (or create a second test account)
3. Click "Create exchange"
4. **Expected:** Redirect to the exchange detail page

**What to expect:**
- Exchange detail page shows:
  - Exchange title
  - Party A (your user ID)
  - Party B (the counterparty ID you entered)
  - Status: "PENDING"
  - Empty file list ("No files have been uploaded to this exchange yet")

### 3.4 Upload a Contract File

**On the exchange detail page:**

**What you should see:**
- Upload form on the left side
- File selection input
- Ownership radio buttons: "My copy" / "Counterparty copy"
- "Upload with KMS envelope" button

**Test Upload:**
1. Click "Select file" and choose a test file (PDF, DOCX, or any file)
2. Select ownership: "My copy"
3. Click "Upload with KMS envelope"
4. **Watch for:**
   - Button shows "Encrypting..." while processing
   - Success message: "File stored with KMS envelope encryption"
   - Hash snippet displayed: "SHA-256: abcd1234...7890"
   - File appears in the "Encrypted files" list

**What to expect in the file list:**
- File name
- Owner: "My copy"
- Uploaded by: Your username
- Upload date/time
- File size
- SHA-256 hash snippet (first 8 chars...last 4 chars)
- "Download & verify" button

### 3.5 Download and Verify Integrity

**On the exchange detail page, for each file:**

**Test Download:**
1. Click "Download & verify" button
2. **Watch for:**
   - Button may show "Verifying..." state
   - File downloads to your browser's download folder
   - **Success:** "Integrity verified" message appears
   - **Failure:** "Integrity FAILED" message (shouldn't happen with valid files)

**What to expect:**
- File downloads successfully
- Integrity verification message appears
- Hash verification happens in the browser
- Downloaded file matches the original

### 3.6 View Dashboard

**Navigate to:** Click "Dashboard" in NavBar or go to `http://localhost:3000`

**What you should see:**
- List of all exchanges where you're Party A or Party B
- For each exchange:
  - Title
  - Party A and Party B IDs
  - Creation date
  - Status badge (PENDING, COMPLETED, etc.)
  - "View exchange →" link

**Test:**
- Click "View exchange →" on any exchange
- Should navigate to that exchange's detail page

### 3.7 Test with Multiple Users (Optional)

To test the full two-party flow:

1. **Sign out** (click "Sign out" in NavBar)
2. **Create a second account** with a different email
3. **Sign in as the second user**
4. **Create an exchange** where Party B is the first user's email/ID
5. **Upload a file** as "Counterparty copy"
6. **Switch back to first user** and verify you can see/download the file

## Step 4: Verify Trust Indicators

Throughout the UX, verify these trust signals are present:

### On Upload Success:
- ✅ "File stored with KMS envelope encryption" message
- ✅ SHA-256 hash snippet displayed

### On Download:
- ✅ "Download & verify" button (not just "Download")
- ✅ "Verifying integrity..." state while processing
- ✅ "Integrity verified" or "Integrity FAILED" message
- ✅ Hash verification happens automatically

### On Exchange Detail Page:
- ✅ Hash snippets shown for each file
- ✅ "Encrypted files" section clearly labeled
- ✅ Cryptographic metadata visible (S3 key, file hash)

## Step 5: Error Scenarios to Test

### 5.1 Unauthorized Access
- Try accessing `/exchanges/[id]` for an exchange you're not part of
- Should show error or redirect

### 5.2 Invalid File Upload
- Try uploading without selecting a file
- Should show error message

### 5.3 Network Errors
- Stop the sandbox while uploading
- Should show appropriate error message

## Step 6: Cleanup

When done testing:

1. **Stop the Next.js dev server:** Press `Ctrl+C` in the terminal running `npm run dev`
2. **Stop the Amplify sandbox:** Press `Ctrl+C` in the terminal running `npx ampx sandbox`
   - This will clean up all deployed resources
   - Or use `npx ampx sandbox --delete` to force cleanup

## Troubleshooting

### Issue: "Unable to resolve contracts function URL"
- **Solution:** Ensure the sandbox has fully deployed and `amplify_outputs.json` exists
- Check that the Lambda function was created successfully
- See **Issue 4** in "Post-Development Issues" if `amplify_outputs.json` is missing

### Issue: "Sign in page shows errors"
- **Solution:** Verify Cognito is configured correctly in `amplify/auth/resource.ts`
- Check that the sandbox deployed the auth resources
- If you see "Auth UserPool not configured", see **Issue 5** in "Post-Development Issues"

### Issue: "amplify_outputs.json is empty or missing"
- **Solution:** This is likely the Amplify Gen 2 output generation bug (see **Issue 4**)
- Follow the workaround steps in "Post-Development Issues" to manually create the file
- Check `FIX_AMPLIFY_OUTPUTS.md` for detailed instructions

### Issue: "Build errors about runWithAmplifyServerContext"
- **Solution:** See **Issue 1** in "Post-Development Issues"
- Ensure you're importing from `@/lib/amplify-server`, not directly from Amplify packages

### Issue: "Runtime error: createContext only works in Client Components"
- **Solution:** See **Issue 2** in "Post-Development Issues"
- Add `"use client"` directive to components using React Context

### Issue: "Runtime error: operation is not a function"
- **Solution:** See **Issue 3** in "Post-Development Issues"
- Use object syntax: `{ operation: ... }` when calling `runWithAmplifyServerContext`

### Issue: "Can't see my exchanges"
- **Solution:** Verify you're signed in (check NavBar for username)
- Check that exchanges were created with your user ID as partyA or partyB

### Issue: "Upload fails"
- **Solution:** Check browser console for errors
- Verify the Lambda function has proper IAM permissions
- Check that S3 bucket and KMS key exist

### Issue: "Download doesn't work"
- **Solution:** Verify the file was uploaded successfully first
- Check browser console for errors
- Verify the Lambda function can decrypt (check CloudWatch logs)

## Quick Test Checklist

- [ ] Can sign up with email/password
- [ ] Can sign in after sign up
- [ ] Can create a new exchange
- [ ] Can upload a file (see encryption message and hash)
- [ ] Can download a file (see integrity verification)
- [ ] Can view dashboard with exchanges
- [ ] Can navigate between pages
- [ ] Trust indicators are visible
- [ ] Hash verification works correctly
- [ ] Sign out works

## Next Steps

Once manual testing is complete:
1. Test with real files (PDFs, DOCX, etc.)
2. Test with larger files (check performance)
3. Test with multiple exchanges
4. Test with multiple files per exchange
5. Verify encryption is actually working (check S3 objects are encrypted)
6. Verify KMS is being used (check CloudWatch logs)

---

**Happy Testing!** 🎉

