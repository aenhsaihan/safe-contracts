# Manual UX Testing Guide for SafeContracts

This guide walks you through testing the SafeContracts application as a regular user would experience it.

## Prerequisites

1. **Node.js 20** - Ensure you're using Node 20 (check with `node --version`)
2. **AWS Credentials** - Your `.env` file should have valid AWS credentials
3. **Dependencies Installed** - Run `npm install` if you haven't already

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

### Issue: "Sign in page shows errors"
- **Solution:** Verify Cognito is configured correctly in `amplify/auth/resource.ts`
- Check that the sandbox deployed the auth resources

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

