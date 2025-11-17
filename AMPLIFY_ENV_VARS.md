# Environment Variables for Amplify Hosting

Based on Amazon Q's recommendations, add these environment variables in Amplify Console to enable detailed error logging:

## Required Environment Variables

1. **NODE_ENV**
   - Value: `production`
   - Purpose: Ensures Next.js runs in production mode

2. **NEXT_PUBLIC_DEBUG**
   - Value: `true`
   - Purpose: Enables debug logging in Next.js

3. **AMPLIFY_APP_ORIGIN** (Optional but recommended)
   - Value: `https://main.dl0ngpjziik46.amplifyapp.com` (your actual Amplify URL)
   - Purpose: Helps Amplify configure CORS and routing correctly

## How to Add

1. Go to **AWS Console → Amplify → Your Hosting App**
2. Click **App settings** → **Environment variables**
3. Click **Manage variables** or **Add variable**
4. Add each variable above
5. **Save**
6. **Redeploy** your app

## After Adding

These variables will:
- Enable more detailed error messages in logs
- Help Next.js provide better error information
- Improve debugging capabilities

---

## CloudWatch Log Groups to Check

After enabling logging, check these log groups for errors:

1. **AppSync API Logs:**
   - `/aws/appsync/apis/[your-api-id]`
   - Find your API ID in `amplify_outputs.json` (looks like `2eqvg2d63fgkbprs4gql66vea4`)

2. **Amplify Hosting Logs:**
   - `/aws/amplify/[your-app-name]/`
   - Look for server-side rendering errors

3. **Lambda Function Logs:**
   - `/aws/lambda/amplify-...contractsFunction...`
   - If Lambda is involved in the error

