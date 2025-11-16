# Vibe Kanban Workflow Manual

## Overview

This manual documents the established workflow for using Vibe Kanban MCP with Cursor to manage and execute coding tasks. This workflow ensures proper isolation, testing, and review before merging code to main.

**Last Updated:** November 16, 2025  
**Status:** Working, continuously improving

---

## Table of Contents

1. [Initial Setup & Connection](#initial-setup--connection)
2. [Initial Issues & Solutions](#initial-issues--solutions)
3. [Finalized Workflow](#finalized-workflow)
4. [Agent Selection Guide](#agent-selection-guide)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)

---

## Initial Setup & Connection

### MCP Configuration

Vibe Kanban MCP server configuration in Cursor settings:

```json
{
  "mcp_servers": {
    "vibe_kanban": {
      "command": "npx",
      "args": ["-y", "vibe-kanban@latest", "--mcp"]
    }
  }
}
```

### Verification

- Vibe Kanban runs at: `http://127.0.0.1:49739`
- MCP functions available:
  - `mcp_vibe-kanban_list_projects`
  - `mcp_vibe-kanban_list_tasks`
  - `mcp_vibe-kanban_get_task`
  - `mcp_vibe-kanban_create_task`
  - `mcp_vibe-kanban_start_task_attempt`
  - `mcp_vibe-kanban_update_task`
  - `mcp_vibe-kanban_delete_task`

---

## Initial Issues & Solutions

### Issue 1: Bypassing Vibe Kanban

**Problem:** Initially, we were implementing tasks directly on `main` branch, bypassing Vibe Kanban's orchestration.

**Solution:** 
- Use `mcp_vibe-kanban_start_task_attempt` to let Vibe Kanban create worktrees and branches
- Do NOT implement code directly - let the agent do the work
- Our role is to oversee, review, and merge

### Issue 2: Stale vk/ Branches

**Problem:** Found stale `vk/` branches that were historical markers, not active feature branches. They were created by Vibe Kanban but work was done directly on main.

**Solution:**
- Identified branches were in worktrees at `/private/var/folders/.../vibe-kanban/worktrees/`
- Removed worktrees first: `git worktree remove <path>`
- Then deleted branches: `git branch -d <branch-name>`

### Issue 3: Agent Not Executing

**Problem:** Task showed "in-progress" but no code was being written. Agent was stuck with "System initialized with model: Auto".

**Solution:**
- Stopped the stuck attempt
- Restarted with `CODEX` executor instead of `CURSOR_AGENT`
- Avoided "Auto" model selection - use specific executors

### Issue 4: Testing Before Merge

**Problem:** Initially considered merging first, then testing (bad practice).

**Solution:**
- Always test in isolation from worktree before merging
- Copy `.env` to worktree: `cp main/.env worktree/.env`
- Install dependencies in worktree: `npm install --legacy-peer-deps`
- Test with Amplify sandbox: `npx ampx sandbox --once`
- Only merge after successful test

---

## Finalized Workflow

### Step-by-Step Process

#### 1. Task Selection & Agent Assessment

```typescript
// Check available tasks
mcp_vibe-kanban_list_tasks(project_id, status: "todo")

// Get task details
mcp_vibe-kanban_get_task(task_id)

// Assess which agent is best:
// - CODEX: Code completion, incremental changes
// - CURSOR_AGENT: General coding, setup, implementation
```

**Available Agents (with API access):**
- `CODEX` - Code completion focused
- `CURSOR_AGENT` - General coding tasks

**Agent Selection Guide:**
- **CODEX**: Best for code completion, incremental changes, small fixes
- **CURSOR_AGENT**: Best for setup, structure creation, full feature implementation

#### 2. Start Task Attempt

```typescript
mcp_vibe-kanban_start_task_attempt(
  task_id: string,
  executor: "CODEX" | "CURSOR_AGENT",  // ⚠️ NEVER use "Auto" or undefined
  base_branch: "main"
)
```

**What Vibe Kanban Does:**
- Creates worktree at `/private/var/folders/.../vibe-kanban/worktrees/{attempt-id}-{task-slug}`
- Creates branch: `vk/{attempt-id}-{task-slug}`
- Sets task status to `in-progress`
- Agent begins working in the isolated worktree

**⚠️ CRITICAL: Verify Executor Immediately**
After starting, immediately check:
1. Task status shows `in-progress` (not stuck)
2. Vibe Kanban UI doesn't show "System initialized with model: Auto"
3. If "Auto" appears, STOP and restart with explicit executor

**Common Mistake:**
- Starting task without verifying executor → Agent uses "Auto" → Task hangs
- **Solution:** Always verify executor is set correctly before moving on

#### 3. Wait for Agent Completion

- **DO NOT** work on the task directly
- Wait for user notification (Vibe Kanban "moo" sound indicates completion)
- Or check task status: `mcp_vibe-kanban_get_task(task_id)`
- Status will change from `in-progress` → `in-review` when done

#### 4. Review Agent Work

```bash
# Check worktree
cd /private/var/folders/.../vibe-kanban/worktrees/{attempt-id}-{task-slug}

# Review changes
git status
git log --oneline -5
git diff main...HEAD

# Check files created
ls -la amplify/backend/functions/...
```

**Review Checklist:**
- ✅ Directory structure correct
- ✅ Files created as expected
- ✅ Code syntax correct
- ✅ Dependencies appropriate
- ✅ Follows project conventions

#### 5. Test in Isolation (Before Merge)

```bash
# Copy .env to worktree
cp /path/to/main/.env /path/to/worktree/.env

# Install dependencies
cd /path/to/worktree
npm install --legacy-peer-deps

# Test with Amplify sandbox
export $(cat .env | grep -v '^#' | xargs)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20
npx ampx sandbox --once
```

**Why Test Before Merge:**
- ✅ Catches issues early
- ✅ No need to revert if test fails
- ✅ Can fix issues in branch before merge
- ✅ Maintains clean main branch

#### 6. Merge to Main

```bash
# Switch to main
cd /path/to/main/repo
git checkout main

# Merge the branch
git merge vk/{attempt-id}-{task-slug} --no-ff -m "feat: descriptive commit message"

# Verify merge
git log --oneline -3
ls -la amplify/backend/functions/...
```

#### 7. Cleanup

```bash
# Remove worktree
git worktree remove /path/to/worktree

# Delete merged branch
git branch -d vk/{attempt-id}-{task-slug}

# Verify cleanup
git worktree list
git branch -a
```

#### 8. Merge to Main

```bash
# From main branch, merge the worktree branch
cd /path/to/main/repo
git merge --no-ff vk/{attempt-id}-{task-slug} -m "feat: description of changes"

# Verify merge
git log --oneline -3
ls -la src/components/...  # verify files are there
```

**Merge Best Practices:**
- Use `--no-ff` to preserve branch history
- Write descriptive commit messages
- Verify files are correctly merged
- Check that no unintended files (like manual updates) are included

#### 9. Cleanup Worktree & Branch

```bash
# Remove worktree
git worktree remove /path/to/worktree

# Delete merged branch
git branch -d vk/{attempt-id}-{task-slug}

# Verify cleanup
git worktree list
git branch -a
```

#### 10. Update Kanban

```typescript
// Task status may auto-update to "done" when branch is merged
// But we should manually update to ensure it's marked complete:
mcp_vibe-kanban_update_task(task_id, status: "done")
```

**Note:** After merging and cleanup, the task should be marked "done" in Vibe Kanban. If it doesn't auto-update, manually update it.

---

## Agent Selection Guide

### CODEX

**Best For:**
- Code completion tasks
- Incremental changes
- Small fixes and refactoring
- TypeScript/JavaScript code generation
- **Reliable fallback** when CURSOR_AGENT defaults to "Auto"

**Example Tasks:**
- "Create contractsFunction Lambda structure" ✅ (worked well)
- "Create crypto-utils helper" ✅ (worked well)
- Code completion in existing files
- Adding dependencies to package.json

**Reliability:**
- ✅ **Always respects executor parameter** - never defaults to "Auto"
- ✅ **Proven to work** - multiple successful tasks completed
- ✅ **Use as fallback** when CURSOR_AGENT has issues

### CURSOR_AGENT

**Best For:**
- Full feature implementation
- Setting up project structure
- Creating new components from scratch
- Complex multi-file changes

**Example Tasks:**
- "Create Auth component wrapper" (attempted, but defaulted to "Auto" - switched to CODEX)
- Setting up new features
- Component architecture setup

**⚠️ Important Notes:**
- **May default to "Auto"** - must verify immediately after starting
- **If "Auto" appears:** Stop immediately and restart with CODEX
- **Verification required:** Check UI within 5-10 seconds to confirm it's not using "Auto"
- **Still preferred** for certain tasks, but requires careful monitoring

### Executor Selection Decision Tree

```
Start Task
    ↓
Choose Executor Based on Task Type
    ↓
    ├─→ CURSOR_AGENT (for full features)
    │       ↓
    │   Verify in UI (5-10 seconds)
    │       ↓
    │   ├─→ "Auto" detected? → STOP → Restart with CODEX
    │   └─→ Working correctly? → Continue
    │
    └─→ CODEX (for code completion OR as fallback)
            ↓
        Verify in UI (5-10 seconds)
            ↓
        ├─→ "Auto" detected? → STOP → Investigate (shouldn't happen with CODEX)
        └─→ "gpt-5-codex" or "gpt-4-codex"? → Continue ✅
```

**Key Principle:** **Never execute with "Auto" - always verify and switch to CODEX if needed**

### Model Selection

**Avoid:** "Auto" model selection (causes issues)  
**Use:** Specific executor (CODEX or CURSOR_AGENT)

---

## Best Practices

### 1. Review in Worktree Without Switching Main Branch

**The Isolated Review Pattern:**

When reviewing a task's work, you can review it directly from the worktree path without ever leaving the main branch:

```bash
# Main branch stays on main
cd /path/to/main/repo  # stay here

# Review using absolute paths to worktree
read_file /path/to/worktree/src/components/auth/Auth.tsx
run_terminal_cmd "cd /path/to/worktree && git status"
run_terminal_cmd "cd /path/to/worktree && git diff main"

# Test in worktree
run_terminal_cmd "cd /path/to/worktree && npm test"

# Merge from main
cd /path/to/main/repo
git merge --no-ff vk/branch-name
```

**Why This Works:**
- Worktrees are separate directories, so you can access them via absolute paths
- Main branch never needs to switch away
- Multiple tasks can be reviewed in parallel
- Clean separation between review and main branch state

**Benefits:**
- ✅ Main branch always stays clean
- ✅ Review happens in complete isolation
- ✅ No risk of accidentally committing to wrong branch
- ✅ Can review multiple tasks simultaneously
- ✅ Easy to test without affecting main

### 2. Always Test Before Merge

```bash
# Test in worktree isolation
# Only merge after successful test
```

### 2. Clean Up After Merge

```bash
# Remove worktrees
# Delete merged branches
# Keep main clean
```

### 3. Use Descriptive Commit Messages

```bash
git merge vk/xxx --no-ff -m "feat: clear description of what was added"
```

### 4. Review Agent Work Thoroughly

- Check file structure
- Verify code quality
- Test compilation
- Verify dependencies

### 5. Update Implementation Plan

After merging, update `safecontracts-mvp-implementation.plan.md` to reflect completed tasks.

---

## Troubleshooting

### Agent Stuck / Not Writing Code

**Symptoms:**
- Task shows "in-progress"
- No commits in branch
- UI shows "Loading draft…" or "System initialized with model: Auto"

**Solution:**
1. Stop the attempt (via UI or wait for timeout)
2. Restart with different executor (try CODEX if CURSOR_AGENT stuck)
3. Avoid "Auto" model selection

### Worktree Already Exists Error

**Error:** `fatal: 'vk/xxx' is already used by worktree`

**Solution:**
```bash
# Remove the worktree first
git worktree remove /path/to/worktree

# Then delete branch
git branch -d vk/xxx
```

### Cannot Checkout Branch (Worktree Conflict)

**Error:** Branch exists in worktree, can't checkout in main repo

**Solution:**
- Work directly in the worktree for testing
- Don't try to checkout in main repo
- Merge from main: `git merge vk/xxx` (works even if branch is in worktree)

### Test Fails in Worktree

**Options:**
1. Fix issues in worktree branch, commit, then merge
2. If unfixable, stop attempt, update task description, restart

### Agent Uses Wrong Versions

**Example:** Function uses AWS SDK 3.520.0, root uses 3.932.0

**Solution:**
- Can fix in follow-up commit after merge
- Or fix in worktree before merge (preferred)

---

## Workflow Summary

```
1. List tasks in Kanban (todo status)
2. Select task and assess best agent (CODEX vs CURSOR_AGENT)
3. Start task attempt via MCP
4. Wait for agent completion (listen for "moo" or check status)
5. Review agent work in worktree
6. Test in isolation (copy .env, install deps, run tests)
7. If test passes: Merge to main
8. Clean up worktrees and branches
9. Update Kanban status (auto-updates on merge)
10. Update implementation plan
```

---

## Key Learnings

1. **Never bypass Vibe Kanban** - Let it orchestrate tasks
2. **Always test in isolation** - Use worktree before merging
3. **Clean up after merge** - Remove worktrees and branches
4. **Choose right agent** - CODEX for completion, CURSOR_AGENT for setup
5. **Avoid "Auto" model** - Use specific executors
6. **Review thoroughly** - Check structure, code, dependencies
7. **Update documentation** - Keep implementation plan current

---

## Continuous Improvement

This workflow is still evolving as we:
- Discover new agent capabilities
- Encounter edge cases
- Optimize the process
- Add new tools and integrations

**Current Status:** ✅ Working well for Lambda function structure creation  
**Next Steps:** Apply to more complex tasks (encryptAndUpload, decryptAndDownload operations)

---

## Post-Mortem: "Auto" Model Issue in Parallel Execution

### Issue Recurrence (November 16, 2025)

**What Happened:**
When attempting parallel task execution for the first time, Task 2 (Create Auth component wrapper) got stuck using "Auto" model selection, even though we explicitly specified `CURSOR_AGENT` as the executor.

**Root Cause:**
- When starting multiple tasks in parallel, we may have inadvertently triggered a default behavior
- The `start_task_attempt` function may have a fallback to "Auto" if the executor parameter isn't properly validated
- We didn't verify the executor was correctly set before the agent started working

**Why It Happened Again:**
1. **Rushed parallel execution setup** - When starting 2 tasks quickly, we didn't verify each one's configuration
2. **Assumed executor parameter was sufficient** - Didn't check if Vibe Kanban actually used the specified executor
3. **No immediate verification step** - Started tasks and moved on without confirming they were using the right model

**How to Prevent:**
1. **Always verify executor after starting** - Check task status immediately after `start_task_attempt`
2. **Check Vibe Kanban UI** - After starting, quickly check the task in UI to confirm it's not using "Auto"
3. **Add verification step to workflow** - Make it a mandatory step: "Start attempt → Verify executor → Continue"
4. **Monitor first few seconds** - Watch the task for 10-15 seconds to catch "Auto" model issues early

**Updated Workflow Step:**
```typescript
// Step 2.5: Verify Executor (NEW)
mcp_vibe-kanban_start_task_attempt(task_id, executor, base_branch)

// IMMEDIATELY verify:
// 1. Check task status
// 2. Check Vibe Kanban UI for "Auto" model warning
// 3. If "Auto" detected, stop and restart with explicit executor
```

**Lesson Learned:**
- Never assume the executor parameter is being used correctly
- Always verify immediately after starting a task attempt
- When running parallel tasks, verify each one individually
- "Auto" model is a red flag - catch it early, don't wait for timeout

**Prevention Checklist:**
- [ ] Verify executor is specified (CODEX or CURSOR_AGENT)
- [ ] Check task status immediately after starting
- [ ] Monitor first 15 seconds for "Auto" model warnings
- [ ] If "Auto" detected, stop immediately and restart
- [ ] Document which executor worked for similar tasks

---

### Critical Discovery: Executor Parameter May Not Work

**Second Failure (November 16, 2025 - Same Day):**

**What Happened:**
After documenting the first failure and implementing prevention steps, we attempted to fix Task 2 by:
1. Resetting task status to "todo"
2. Cleaning up all old worktrees
3. Starting fresh with explicit `CURSOR_AGENT` executor

**Result:** The attempt STILL showed "System initialized with model: Auto" in the UI, despite explicitly passing `executor: "CURSOR_AGENT"` to `start_task_attempt`.

**Root Cause Analysis:**
- The `executor` parameter in `start_task_attempt` may not be working as expected
- Vibe Kanban may be ignoring the executor parameter and defaulting to "Auto"
- There may be a bug in Vibe Kanban's MCP implementation
- Or the executor needs to be specified differently (e.g., via UI, not MCP)

**Why This Is Critical:**
- We cannot rely on the `executor` parameter to work correctly
- Even with proper workflow (reset → cleanup → start fresh), the issue persists
- This suggests a systemic problem, not just a workflow mistake

**Investigation Needed:**
1. Check if executor parameter is actually being passed correctly
2. Verify if Vibe Kanban UI has a way to set executor that works
3. Test if CODEX works differently than CURSOR_AGENT
4. Document workaround if executor parameter is broken

**Temporary Workaround:**
- If executor parameter doesn't work, we may need to:
  - Use Vibe Kanban UI to manually set executor before starting
  - Or accept that some attempts will use "Auto" and stop/restart them
  - Or investigate if there's a different MCP function or parameter format

**Status:** ⚠️ **UNRESOLVED** - Executor parameter appears to be ignored by Vibe Kanban

---

### Resolution: CODEX Works, CURSOR_AGENT May Not

**Third Attempt (November 16, 2025 - Same Day):**

**What Happened:**
After stopping the stuck attempt and resetting the task, we tried starting with `CODEX` executor (which worked successfully for Task 1).

**Result:** ✅ **SUCCESS!** The attempt shows "model: gpt-5-codex" in the UI and the agent is actively working.

**Key Discovery:**
- **CODEX executor works correctly** when specified via `start_task_attempt`
- **CURSOR_AGENT may have issues** - all attempts with CURSOR_AGENT defaulted to "Auto"
- The executor parameter **does work**, but only for certain executors (CODEX)

**Why This Matters:**
- Not all executors behave the same way
- CODEX appears to respect the executor parameter
- CURSOR_AGENT may ignore it or have a bug

**Solution:**
- **Use CODEX for tasks** until CURSOR_AGENT executor issue is resolved
- If CURSOR_AGENT is needed, verify it's actually using the specified model
- Document which executors work correctly

**⚠️ CRITICAL INSIGHT: The "Auto" Model is the Real Problem**

**The Core Issue:**
- **"Auto" model is the main blocker** - as long as we avoid "Auto", we should be fine
- Both CODEX and CURSOR_AGENT can work, but CODEX is more reliable at respecting the executor parameter
- The goal is to **never execute with "Auto"** - always use an explicit executor

**Executor Selection Strategy:**
- **Primary choice:** Use the executor that best fits the task (CODEX for code completion, CURSOR_AGENT for full features)
- **Fallback strategy:** If CURSOR_AGENT defaults to "Auto", immediately switch to CODEX
- **Verification required:** Always verify the executor is actually being used (check for "model: gpt-5-codex" or similar, NOT "Auto")

**When to Use Each Executor:**
- **CODEX:** 
  - Reliable fallback when CURSOR_AGENT fails
  - Good for code completion and incremental changes
  - Always respects executor parameter
  - Use when you need guaranteed execution without "Auto"
  
- **CURSOR_AGENT:**
  - Preferred for full feature implementation
  - Better for setting up project structure
  - **BUT:** Must verify it's not using "Auto" - if it does, switch to CODEX immediately

**Best Practice:**
1. Try CURSOR_AGENT first if it fits the task
2. **Immediately verify** it's not using "Auto" (within 5-10 seconds)
3. If "Auto" appears, stop and restart with CODEX
4. CODEX is the reliable fallback that unblocks us when CURSOR_AGENT has issues

**Updated Workflow:**
1. Stop stuck attempt (via UI Stop button)
2. Reset task to "todo"
3. Clean up old worktree
4. Start with **CODEX** executor (known to work) OR try CURSOR_AGENT first if preferred
5. **IMMEDIATELY verify** in UI: should show "model: gpt-5-codex" or "model: gpt-4-codex" (CODEX) or similar for CURSOR_AGENT, but **NOT "Auto"**
6. If "Auto" appears, stop immediately and restart with CODEX
7. Monitor agent progress

**Status:** ✅ **RESOLVED** - Avoid "Auto" model at all costs. CODEX is reliable fallback when CURSOR_AGENT defaults to "Auto"

---

### User Experience Divergence: UI Verification Challenges

**Fourth Attempt (November 16, 2025 - Same Day):**

**What Happened:**
After successfully restarting the task with CODEX, there was a divergence in what the user and assistant were seeing:
- **Assistant's view:** Could see "model: gpt-5-codex" in the UI snapshot, confirming CODEX was working
- **User's view:** Initially couldn't see the difference in their UI, thought it wasn't working
- **Reality:** CODEX was actually working correctly all along

**Why the Divergence Occurred:**
1. **UI Refresh Timing:** The user's browser may not have refreshed immediately when the attempt started
2. **Different Views:** The assistant was viewing the attempt detail page, while the user may have been on a different page (task list, etc.)
3. **UI Loading States:** The "Loading draft…" and "DEFAULT" button may have appeared before the model indicator loaded
4. **Visual Confirmation Needed:** The user needed to see active agent behavior (commands running, files being created) to confirm it was working

**How We Aligned:**
1. **Stopped and Restarted:** We stopped the attempt to verify the Stop button worked
2. **Restarted with CODEX:** Started fresh with explicit CODEX executor
3. **Verified in UI:** Both confirmed "model: gpt-5-codex" appeared in the attempt detail page
4. **Observed Active Work:** Both saw the agent actively exploring the repository and preparing to create files

**Key Lessons:**
- **UI may lag:** The model indicator might not appear immediately - wait a few seconds
- **Check the right page:** Make sure you're viewing the attempt detail page, not just the task list
- **Look for activity:** Active agent behavior (commands, file operations) is a better indicator than just the model text
- **Refresh if needed:** If unsure, refresh the browser or navigate to the attempt detail page
- **Verify in detail view:** The model indicator ("model: gpt-5-codex" or "System initialized with model: Auto") appears in the attempt detail view, not always in the task list

**Verification Checklist:**
- [ ] Navigate to the attempt detail page (click on the attempt in the attempts list)
- [ ] Wait 3-5 seconds for UI to load
- [ ] Look for "model: gpt-5-codex" or "model: gpt-4-codex" (CODEX working) OR "System initialized with model: Auto" (problem)
- [ ] Check for active agent behavior (commands running, files being created)
- [ ] If you see "Auto", stop immediately and restart with CODEX
- [ ] If you see "gpt-5-codex" or "gpt-4-codex", the agent is working correctly

**Status:** ✅ **RESOLVED** - Both user and assistant can now verify CODEX is working via UI

---

## Quick Reference

### MCP Functions

```typescript
// List tasks
mcp_vibe-kanban_list_tasks(project_id, status: "todo" | "in-progress" | "in-review" | "done")

// Get task details
mcp_vibe-kanban_get_task(task_id)

// Start task attempt
mcp_vibe-kanban_start_task_attempt(
  task_id,
  executor: "CODEX" | "CURSOR_AGENT",
  base_branch: "main"
)

// Update task status
mcp_vibe-kanban_update_task(task_id, status: "done" | "in-review" | ...)
```

### Git Commands

```bash
# List worktrees
git worktree list

# Remove worktree
git worktree remove /path/to/worktree

# Merge branch
git merge vk/xxx --no-ff -m "feat: description"

# Delete branch
git branch -d vk/xxx
```

---

**Remember:** The goal is to let Vibe Kanban orchestrate, agents execute, and we oversee, review, and merge. This ensures proper isolation, testing, and code quality.

