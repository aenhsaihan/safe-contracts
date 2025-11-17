# Step-by-Step Deployment Guide

## Step 1: Commit the Updated amplify.yml ✅

The `amplify.yml` is already updated. Let's commit it:

```bash
git add amplify.yml
git commit -m "Configure Amplify Hosting to pull backend config during build"
git push
```

---

## Step 2: Deploy Backend to Named Environment

Your backend is currently running in a "sandbox" (temporary). We need to deploy it to a named environment that Amplify Hosting can reference.

**Run this command:**
```bash
npx ampx deploy --branch main
```

**What this does:**
- Promotes your sandbox backend to a persistent environment named "main"
- Creates an Amplify App with an App ID
- Makes the backend accessible to Amplify Hosting

**After it completes, you'll see:**
- An App ID (looks like `dl0ngpjziik46` or similar)
- Environment name: `main`
- ✅ Save these values - you'll need them in Step 4!

**Note:** This may take 5-10 minutes. The backend resources (Cognito, AppSync, Lambda, S3, KMS) will be deployed.

---

## Step 3: Push Code to Git

Make sure your code is pushed to GitHub:

```bash
git add .
git commit -m "Prepare for Amplify Hosting deployment"
git push origin main
```

---

## Step 4: Set Environment Variables in Amplify Hosting

1. **Go to AWS Console:**
   - Navigate to: AWS Console → Amplify → Your Hosting App

2. **Open Environment Variables:**
   - Click on your app
   - Go to: **App settings** → **Environment variables**

3. **Add these two variables:**
   - **Variable name:** `AMPLIFY_APP_ID`
     - **Value:** The App ID from Step 2 (e.g., `dl0ngpjziik46`)
   
   - **Variable name:** `AMPLIFY_ENV_NAME`
     - **Value:** `main` (or whatever environment name you used in Step 2)

4. **Save** the environment variables

---

## Step 5: Redeploy

1. **In Amplify Hosting Console:**
   - Go to your app
   - Click **"Redeploy this version"** or wait for the next automatic deployment

2. **Watch the build logs:**
   - You should see: "Pulling Amplify backend configuration..."
   - The build should complete successfully

3. **Get your public URL:**
   - Once deployed, you'll see a URL like: `https://main.xxxxx.amplifyapp.com`
   - This is your live app! 🎉

---

## Troubleshooting

### If build still fails with "amplify_outputs.json not found":

1. **Check environment variables are set:**
   - Verify `AMPLIFY_APP_ID` and `AMPLIFY_ENV_NAME` are in Amplify Hosting console

2. **Check backend deployment:**
   - Make sure Step 2 completed successfully
   - Verify the App ID matches what you set in environment variables

3. **Check build logs:**
   - Look for the "Pulling Amplify backend configuration..." message
   - If you see "Warning: AMPLIFY_APP_ID or AMPLIFY_ENV_NAME not set", the variables aren't configured correctly

### If you get permission errors:

- Make sure your AWS credentials have permissions for:
  - Amplify (to pull backend config)
  - The backend resources (Cognito, AppSync, Lambda, etc.)

---

## Next Steps After Successful Deployment

1. ✅ Test sign up / sign in
2. ✅ Test file upload
3. ✅ Test file download
4. ✅ Share the URL with others!

---

## Quick Reference

**Commands:**
```bash
# Deploy backend
npx ampx deploy --branch main

# Push code
git push origin main
```

**Environment Variables to Set:**
- `AMPLIFY_APP_ID` = Your backend app ID
- `AMPLIFY_ENV_NAME` = `main`

**Where to Set:**
- AWS Console → Amplify → Your Hosting App → App settings → Environment variables

