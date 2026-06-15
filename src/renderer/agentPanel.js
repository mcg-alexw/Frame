/**
 * Agent Panel
 *
 * The Agent rail view's "Running agents" list: one row per Frame that
 * currently has a live agent, across ALL projects. Each row shows the agent,
 * its Frame (and project, when not the active one) and a live status; clicking
 * focuses that Frame — switching project first when the agent runs elsewhere.
 *
 * Derived state only: the list is recomputed from laneStatus + the open-
 * terminal set on every change, so a crashed agent or a closed Frame can never
 * leave a stale row (no stored "running" flag to forget to clear). Initialized
 * with the MultiTerminalUI instance, the same idiom as laneStatus / agentDispatch.
 */

const { ipcRenderer } = require('electron');
const { IPC } = require('../shared/ipcChannels');
const laneStatus = require('./laneStatus');
const state = require('./state');

let multiTerminalUI = null;
let listEl = null;
let scheduled = false;

// status → { dot flavor, label }. Only attention/activity states are mapped;
// anything else (a live agent sitting at a settled prompt) reads as "Ready".
const STATUS_META = {
  'agent-working': { flavor: 'working', label: 'Working' },
  'agent-approval': { flavor: 'approval', label: 'Needs approval' },
  'agent-input': { flavor: 'input', label: 'Awaiting input' }
};

/**
 * @param {object} ui - the live MultiTerminalUI (for getManager()).
 */
function init(ui) {
  multiTerminalUI = ui;
  listEl = document.getElementById('agent-running-list');

  // Status transitions emit through laneStatus; a destroyed terminal does not,
  // so recompute on destroy too. Both paths are debounced to one rAF.
  laneStatus.onChange(() => schedule());
  ipcRenderer.on(IPC.TERMINAL_DESTROYED, () => schedule());

  recompute();
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    recompute();
  });
}

/**
 * Rebuild the running-agents list from the live terminal + status state,
 * grouped under a heading per project (active project first).
 */
function recompute() {
  if (!listEl || !multiTerminalUI) return;

  let states;
  try {
    states = multiTerminalUI.getManager().getTerminalStates(true);
  } catch (_) {
    states = [];
  }

  const currentProject = state.getProjectPath();
  const nameByPath = _projectNames();

  // Group agents by their project path. Map preserves first-seen order, which
  // we then nudge so the active project sorts to the top.
  const groups = new Map(); // path -> { name, agents: [] }
  for (const s of states) {
    const st = laneStatus.getStatus(s.id);
    if (!st.agentName) continue; // only lanes with a live agent process
    const path = s.projectPath || null;
    if (!groups.has(path)) {
      groups.set(path, {
        name: path ? (nameByPath.get(path) || _basename(path)) : 'No project',
        agents: []
      });
    }
    groups.get(path).agents.push({
      id: s.id,
      agentName: st.agentName,
      status: st.status,
      frameName: s.customName || s.name,
      projectPath: path
    });
  }

  if (groups.size === 0) {
    listEl.innerHTML = '<div class="agent-running-empty">No agents running — pick an agent and hit Start.</div>';
    return;
  }

  const ordered = [...groups.entries()].sort(
    (a, b) => (a[0] === currentProject ? 0 : 1) - (b[0] === currentProject ? 0 : 1)
  );

  listEl.innerHTML = '';
  for (const [, group] of ordered) {
    const groupEl = document.createElement('div');
    groupEl.className = 'agent-running-group';

    const title = document.createElement('div');
    title.className = 'agent-running-group-title';
    title.innerHTML = '<svg class="agent-running-group-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>'
      + '</svg><span class="agent-running-group-name"></span>';
    title.querySelector('.agent-running-group-name').textContent = group.name;
    groupEl.appendChild(title);

    for (const a of group.agents) groupEl.appendChild(_buildRow(a));
    listEl.appendChild(groupEl);
  }
}

// One running-agent row. The project is already the group heading, so the
// sub-line is just the Frame name.
function _buildRow(a) {
  const meta = STATUS_META[a.status] || { flavor: 'ready', label: 'Ready' };
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'agent-running-item';
  row.title = `Focus ${a.frameName}`;
  row.innerHTML = `
    <span class="agent-running-dot ${meta.flavor}"></span>
    <span class="agent-running-info">
      <span class="agent-running-name"></span>
      <span class="agent-running-sub"></span>
    </span>
    <span class="agent-running-status ${meta.flavor}"></span>
  `;
  row.querySelector('.agent-running-name').textContent = _label(a.agentName);
  row.querySelector('.agent-running-sub').textContent = a.frameName;
  row.querySelector('.agent-running-status').textContent = meta.label;
  row.addEventListener('click', () => _focus(a));
  return row;
}

// path -> the workspace's display name for that project (fallback: basename).
function _projectNames() {
  const map = new Map();
  try {
    for (const p of require('./projectListUI').getProjects()) map.set(p.path, p.name);
  } catch (_) { /* projectListUI not ready — basenames are fine */ }
  return map;
}

// Focus the agent's Frame. When it lives in another project, switch to that
// project first (state.setProjectPath drives multiTerminalUI.setCurrentProject)
// so the lane is in view before we enter it.
function _focus(a) {
  if (!multiTerminalUI) return;
  if (a.projectPath && a.projectPath !== state.getProjectPath()) {
    state.setProjectPath(a.projectPath);
  }
  multiTerminalUI.enterLane(a.id);
}

function _label(agentName) {
  return agentName ? agentName.charAt(0).toUpperCase() + agentName.slice(1) : 'Agent';
}

function _basename(p) {
  return p.split('/').pop() || p.split('\\').pop() || p;
}

module.exports = { init, recompute };
