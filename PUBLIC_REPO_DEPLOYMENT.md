# Deployment for Public Repository

## Security Consideration

Since your repository is **public**, we should avoid committing `amplify_outputs.json` which contains:
- AWS Account ID
- Public endpoints (though these are already visible)

## Recommended Approach: Use Environment Variables

Instead of committing the config file, we'll use Amplify Hosting's environment variables to pull the backend config during build.

---

## Step 1: Create Backend App in Amplify Console

1. **Go to AWS Console:**
   - Navigate to: **AWS Console → Amplify → Backend environments**

2. **Create a new backend:**
   - Click **"Create backend"** or **"New app"**
   - Select **"Deploy without Git provider"** or connect your Git repo
   - Choose **"Backend only"** (not full-stack)
   - This will create a persistent backend environment

3. **Get your App ID:**
   - After creation, you'll see an **App ID** (looks like `dl0ngpjziik46`)
   - Save this value!

4. **Note the environment name:**
   - Usually `main` or `production`
   - Save this too!

---

## Step 2: Set Environment Variables in Amplify Hosting

1. **Go to your Amplify Hosting app:**
   - AWS Console → Amplify → Your Hosting App

2. **Open Environment Variables:**
   - Click on your app
   - Go to: **App settings** → **Environment variables**

3. **Add these variables:**
   - **Variable name:** `AMPLIFY_APP_ID`
     - **Value:** The App ID from Step 1
   
   - **Variable name:** `AMPLIFY_ENV_NAME`
     - **Value:** `main` (or your environment name from Step 1)

4. **Save** the environment variables

---

## Step 3: Commit and Push

The `amplify.yml` is already configured to pull the backend config using these environment variables:

```bash
git add amplify.yml
git commit -m "Configure Amplify Hosting to pull backend config via environment variables"
git push
```

---

## Step 4: Redeploy

1. **In Amplify Hosting:**
   - The next build will automatically pull `amplify_outputs.json` using the environment variables
   - Watch the build logs - you should see: "Pulling Amplify backend configuration..."

2. **Verify:**
   - Build should complete successfully
   - Your app will be live!

---

## Alternative: If You Can't Create Backend App

If creating a backend app in the console is too complex, you can:

1. **Temporarily commit `amplify_outputs.json`** (for initial deployment)
2. **Then immediately:**
   - Create the backend app in console
   - Set environment variables
   - Remove `amplify_outputs.json` from git
   - Update `.gitignore` to exclude it again

This way it's only public for a short time.

---

## Security Best Practices

✅ **Do:**
- Use environment variables for sensitive config
- Keep AWS credentials out of the repo (already in `.env` which is gitignored)
- Use IAM roles with least privilege

❌ **Don't:**
- Commit AWS access keys or secrets
- Commit `.env` files
- Expose private keys or passwords

The endpoints in `amplify_outputs.json` are already public (visible in browser network requests), but it's still better practice to not commit them to a public repo.

