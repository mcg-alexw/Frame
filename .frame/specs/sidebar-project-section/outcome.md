# Outcome — Sidebar Project Section

## T01 — Add the Open Project modal markup to `index.html`

Added an `#open-project-modal` `.modal-overlay` block after `#initialize-frame-modal`, mirroring its structure (modal-container/header/body/footer with a `modal-close`). Body holds three `.open-project-option` buttons (Select Folder / Create New / Clone GitHub Repo) plus a hidden `#open-project-clone-form` (URL input + error slot) and a hidden clone footer with Back/Clone buttons revealed by the clone toggle. Markup only — no JS wiring yet (T02) and styling lands in T04, so the option/form classes are currently unstyled.

_Captured: 2026-06-12 · 1 file change_

---

## T02 — Create `openProjectModal.js`

Created `src/renderer/openProjectModal.js` — a UI shell over the existing open flows: Select/Create delegate to `state`, Clone sends `CLONE_GITHUB_REPO`, with `.visible`-class show/hide and Escape gated on visibility (no terminal key leak). Wired `openProjectModal.init()` in `index.js` and repointed the `CLONE_GITHUB_REPO_RESULT` listener to call `handleCloneResult()` (inline error on failure, close + `setProjectPath` on success). The result listener stayed in `index.js` per plan.

_Captured: 2026-06-12 · 2 file changes_

---

## T03 — Projects section block + `projectSection.js`

Added the `#project-section` block under `#sidebar-header` (toggle/chevron + name, `+` button, empty-state CTA, body placeholder) and created `src/renderer/projectSection.js` owning in-memory collapse/expand (a `collapsed`/`expanded` class on the root) and wiring `+`/CTA to the modal. Exposed `expand/collapse/toggle/focusList` and inited it in `index.js`.

_Captured: 2026-06-12 · 3 file changes_

---

## T04 — `project-section.css`

Added `src/renderer/styles/components/project-section.css` (header row, rotating chevron, collapsed/expanded list visibility, dashed empty-state CTA, Open Project modal option cards + clone form) using theme variables, and registered it via `@import` in `main.css`.

_Captured: 2026-06-12 · 2 file changes_

---

## T05 — Rehome list + per-project actions into the section

Moved `#projects-list`, the AI tool row (`#btn-start-ai` + `#ai-tool-selector`), and the `#btn-initialize-frame` wrapper into `#project-section-body`, with `#init-frame-tooltip` placed as a fixed-position sibling. Removed the entire old Projects tab content in the same edit to avoid duplicate IDs — which also lands most of T07's markup removal (stacked Select/Create/Clone buttons, inline clone row, duplicate `#projects-header` `+`).

_Captured: 2026-06-12 · 1 file change_

---

## T06 — Repoint active-project display in `state.js`

Pointed `state.init`'s `pathElement` at `#project-section-name` and reworked `updateProjectUI()` to render the project **name** (full path as `title`) and toggle the empty-state CTA vs. section body across both branches. Added an `updateProjectUI()` call at the end of `init()` so the no-project empty state renders on first load (it previously wasn't invoked at startup). Dropped the old inline `style.color` writes — color now comes from CSS.

_Captured: 2026-06-12 · 2 file changes_

---

## T07 — Remove Projects tab + dead handlers

Removed the `projects` tab button (Files is now the default active tab, panel un-hidden) and deleted the dead `btn-select-project`/`btn-create-project`/clone-row/`btn-add-project` handlers in `index.js` (the old tab markup was already removed in T05). Divergence from plan: two off-spec callers of the removed buttons were also remapped to avoid silent regressions — `laneBoard.js`'s no-project CTA now sends `SELECT_PROJECT_FOLDER` directly, and `welcomeOverlay.js`'s Clone CTA opens the modal via a new `open({ clone: true })` option.

_Captured: 2026-06-12 · 4 file changes_

---

## T08 — Remap commands

Changed `focus.projectList` (`Cmd+E`) to ensure the sidebar is visible then call `projectSection.focusList()` (expand + `projectListUI.focus()`) instead of `revealSidebarTab('projects')`, and routed `project.add`/`project.create` through `openProjectModal.open()`. Files/Changes focus commands and `project.next/prev` untouched.

_Captured: 2026-06-12 · 1 file change_

---

## T09 — Sample/overlay interplay + STRUCTURE.json

Confirmed the sample-project and any project flow still highlight in the section (same `#projects-list` driven by `projectListUI` via `onProjectChange`), and the empty-state CTA (sidebar) does not conflict with the welcome overlay (separate full-screen overlay). Regenerated `STRUCTURE.json` via `npm run structure`, registering `renderer/openProjectModal` and `renderer/projectSection` (83 modules). Note: verification was static (syntax + reference sweep + duplicate-ID check), not a live app launch.

_Captured: 2026-06-12 · 1 file change_

---

## Refinement — keep recent projects visible in the empty state (post-T06)

Per user feedback: the no-active-project state was hiding the whole section body, which removed the previously-opened (workspace) project list — a liked feature. Changed `updateProjectUI()` to toggle a `has-project` class instead of hiding the body; CSS now hides `#projects-list` only when `.collapsed.has-project`, so with no active project the recent-projects list always shows alongside the "Open a project +" CTA. Also hide the chevron and AI tool row when there's no active project. Files: `state.js`, `project-section.css`.

_Captured: 2026-06-12 · 2 file changes_

---

## Refinement 2 — Projects section becomes a minimal draggable list (post-spec)

Per user feedback, dropped the collapsed active-project header row entirely: the section is now just a "Projects" label + `+` button (tighter gap to the sidebar header) above the workspace list. List shows max 3 rows then scrolls (`max-height` in CSS) and items are **drag-reorderable with persistence** — added IPC `REORDER_WORKSPACE_PROJECTS` + `workspace.reorderProjects()`, and `projectListUI` now renders in stored order (removed the lastOpenedAt recency sort) and scrolls the active project into view. Start-AI + Initialize-as-Frame were **parked** in a hidden `#parked-project-actions` holder (elements kept so `ai.startSession` command + init flow stay wired; spotlight guarded against the hidden button) pending the user's proposal for their new home. Files: `index.html`, `projectSection.js` (simplified — no collapse), `projectListUI.js`, `project-section.css`, `state.js`, `ipcChannels.js`, `workspace.js`. Followup: user will propose a new home for the parked Start/Initialize actions.

_Captured: 2026-06-12 · 7 file changes_

---

## Refinement 3 — auto-prompt to initialize non-Frame projects (post-spec)

Reused the existing `initialize-frame-modal` as an auto-prompt: switching to a non-Frame project now opens it automatically (hooked in `state.setIsFrameProject` when `!isFrame`, skipping the bundled sample). Relabeled Cancel→"Not Now", added a lead-in line and a "Don't ask again for this project" checkbox; dismiss paths route through `dismissInitPrompt()` which, when checked, adds the path to an in-memory `frameInitPromptSuppressed` Set — per-project, session-scoped, so it asks again after restart. Files: `index.html`, `state.js`, `panels.css`. Note: suppression is per-project (matches "her bu projeye geçiş"), not global; the parked Initialize button still opens the same modal manually.

_Captured: 2026-06-12 · 3 file changes_

---
