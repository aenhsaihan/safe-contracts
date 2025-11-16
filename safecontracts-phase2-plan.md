# SafeContracts Phase 2: Exchange File Workflows

This document captures the next slice of work required after the MVP. Phase 1 proved out exchange creation, auth, and basic dashboards. Phase 2 focuses on the core encrypted file workflow so both parties can actually exchange documents.

---

## 1. Goals

1. Party A and Party B can upload encrypted files to an exchange.
2. Each upload runs the existing `contractsFunction` Lambda (`encryptAndUpload`) and stores metadata in Amplify Data.
3. Either party can download any file they are authorized to see (`decryptAndDownload`).
4. Exchange status automatically transitions from `PENDING` → `COMPLETED` after the first successful upload.
5. All UI states (loading, success, failure) are visible so users understand what happened.

Non goals for this phase:
- External sharing links
- Versioning / multiple revisions per file
- Email notifications

---

## 2. UX / UI Enhancements

### 2.1 Exchange Detail Page

1. **Upload Form**
   - Reintroduce `UploadForm` in `src/components/contracts/UploadForm.tsx`.
   - Display for both parties when they have access to the exchange.
   - Fields: file input, owner selection (Party A/B), optional description.
   - Submit button triggers a server action (see §3).

2. **File List**
   - Render each stored file in the `Encrypted files` section.
   - Show: filename, owner, uploader, timestamps, SHA-256 hash snippet, file size.
   - Add a “Download & verify” button per row.

3. **Status Pill**
   - Status stays `PENDING` until at least one file exists; then switch to `COMPLETED`.
   - If all files are deleted (future work), revert to `PENDING`.

4. **Toasts / inline messages**
   - Success message after upload completes and page refreshes.
   - Error summary if the lambda invocation fails (missing KMS key, etc.).

### 2.2 Dashboard

1. Add a simple badge showing number of files in each exchange.
2. Optionally surface the most recent file timestamp to show activity.

---

## 3. Backend / Server Actions

1. **Upload Server Action**
   - Lives alongside the exchange detail page (server component).
   - Validates inputs (file size limit, MIME, etc.).
   - Calls `invokeContractsFunction("encryptAndUpload", payload)`.
   - Payload must include `exchangeId`, `ownerId`, `uploaderId`, file metadata + base64 contents.
   - On success, call `revalidatePath` for the exchange detail and dashboard.

2. **Download Handler**
   - Add a route handler (`/exchanges/[id]/files/[fileId]/download`) or server action that invokes `decryptAndDownload`.
   - Stream the resulting file back to the browser with the original filename.

3. **Status Management**
   - After upload completes, set `status = "COMPLETED"` for that exchange.
   - Use the existing data client via GraphQL helpers.

4. **Authorization checks**
   - Ensure the server action verifies the current user is either `partyAId` or `partyBId`.
   - Prevent cross-exchange access by checking the exchange ID before calling the lambda.

---

## 4. Data / Schema Considerations

Current schema (Amplify Data) already supports the necessary metadata:
- `ContractExchange` with `status`.
- `ContractFile` with encryption context fields.

Potential additions (optional for this phase):
1. `description` field on `ContractFile`.
2. `uploadedAt` timestamp (could reuse `createdAt`).

If we add fields, run `amplify sandbox` to regenerate GraphQL types.

---

## 5. Testing Plan

1. **Party A workflow**
   - Sign in as Party A, create exchange, upload file, confirm status flips to completed.
   - Download the same file and verify hash matches.

2. **Party B workflow**
   - Sign in as Party B (use correct Cognito `sub` entry).
   - See the exchange created by Party A, upload a second file, download both files.

3. **Unauthorized access**
   - Sign in as a third account, verify exchange detail responds with 404 or error.

4. **Lambda failure simulation**
   - Temporarily break KMS permissions (or mock failure) to ensure errors surface in UI.

5. **Cross-browser smoke test**
   - Chrome + Safari at minimum to confirm file downloads work.

---

## 6. Deliverables

1. Updated Exchange detail UI (upload + download).
2. New server actions / route handlers for file operations.
3. Dashboard tweaks reflecting file counts.
4. Documentation updates:
   - `MANUAL_UX_TESTING_GUIDE.md` to cover upload/download flows.
   - README note about entering Cognito `sub` for counterparty.
5. Automated tests (if feasible) or manual test checklist included in repo.

---

## 7. Tracking / Next Steps

- Use this plan to create tasks in the Kanban board (upload, download, status, docs).
- Land each subsection in separate PRs if needed.
- Once complete, we can plan Phase 3 (notifications, sharing links, etc.).


