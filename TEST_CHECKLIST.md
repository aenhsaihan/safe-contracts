# SafeContracts Manual Test Checklist

Use this checklist during release testing to exercise the most critical user journeys and resilience scenarios. Each block should be executed end-to-end in a single session so that state transitions (exchange creation, file uploads, download integrity) are validated together.

## Party A workflow

- [ ] Create a fresh exchange as Party A, using the counterparty's Cognito `sub` string for the identifier field.
- [ ] Upload at least one document as "My copy" and wait for the "File stored with KMS envelope encryption" confirmation plus the SHA-256 hash snippet.
- [ ] Trigger "Download & verify" for the new file without refreshing the page; confirm the button shows the "Verifying integrity..." state and ends with "Integrity verified".
- [ ] Re-open the exchange from the dashboard to ensure the uploaded file persists with the correct ownership label and hash metadata.

## Party B workflow

- [ ] Sign in as the counterparty account and navigate to the exchange created above; confirm it appears in the dashboard.
- [ ] Upload one file as "My copy" and another as "Counterparty copy" to ensure Party B can contribute both perspectives.
- [ ] Download both Party B uploads plus Party A's original file, verifying that each triggers the hash confirmation toast and that Party B can only download exchanges they are assigned to.
- [ ] Sign back in as Party A and confirm Party B's uploads are visible, downloadable, and display distinct hash snippets.

## Unauthorized access control

- [ ] Sign in as a third Cognito user who is not partyA or partyB on the test exchange.
- [ ] Attempt to open the exchange detail route directly (e.g., `/exchanges/{id}`) and ensure you receive a 404 or explicit authorization error without leaking metadata.
- [ ] Try calling the download action from the browser console (or by hitting the REST endpoint via curl) and verify the call is rejected with an authorization failure.

## Lambda failure simulation

- [ ] With a signed-in user, temporarily break the Lambda path (stop the Amplify sandbox, revoke IAM permissions, or set `CONTRACTS_FUNCTION_URL` to an invalid value) before attempting an upload.
- [ ] Upload a file and confirm the UI surfaces an actionable error ("Lambda invocation failed" or similar) rather than hanging.
- [ ] Restore the Lambda connection and retry the upload to prove recovery works within the same browser session.

## Cross-browser smoke test

- [ ] Repeat the Party A+B happy path (create exchange, upload, download, verify hashes) in Chrome.
- [ ] Repeat the same workflow in Safari, paying attention to file picker, download behavior, and integrity messages.
- [ ] Confirm both browsers retain authentication (Amplify cookies) and that drag/drop or multi-upload behaviors don't regress between engines.
