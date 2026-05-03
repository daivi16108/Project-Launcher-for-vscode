// @ts-check
'use strict';

const vscode = require('vscode');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OUTPUT_CHANNEL_NAME = 'Project Launcher';
const EXTENSION_ID = 'projectLauncher';

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------

/** @type {ActivityItem[]} */
let activityLog = [];

/** @type {vscode.EventEmitter<ActivityItem | undefined>} */
let activityChangeEmitter;

class ActivityItem extends vscode.TreeItem {
  /**
   * @param {string} message
   * @param {string} [iconId]
   */
  constructor(message, iconId) {
    const timestamp = new Date().toLocaleTimeString();
    super(`[${timestamp}]  ${message}`, vscode.TreeItemCollapsibleState.None);
    this.tooltip = message;
    if (iconId) {
      this.iconPath = new vscode.ThemeIcon(iconId);
    }
  }
}

/**
 * @param {string} message
 * @param {string} [iconId]
 */
function addActivity(message, iconId) {
  const cfg = vscode.workspace.getConfiguration(EXTENSION_ID);
  const limit = cfg.get('activityItemLimit', 50);
  activityLog.unshift(new ActivityItem(message, iconId));
  if (activityLog.length > limit) {
    activityLog.length = limit;
  }
  if (activityChangeEmitter) {
    activityChangeEmitter.fire(undefined);
  }
}

// ---------------------------------------------------------------------------
// Tree Data Providers
// ---------------------------------------------------------------------------

class ControlPanelItem extends vscode.TreeItem {
  /**
   * @param {string} label
   * @param {string} commandId
   * @param {string} iconId
   * @param {string} [description]
   */
  constructor(label, commandId, iconId, description) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.command = { command: commandId, title: label };
    this.iconPath = new vscode.ThemeIcon(iconId);
    if (description) {
      this.description = description;
    }
    this.contextValue = 'controlPanelButton';
  }
}

class BindingItem extends vscode.TreeItem {
  /**
   * @param {string} role   - e.g. "Start Task"
   * @param {string} label  - the configured task label (or "(not set)")
   */
  constructor(role, label) {
    const display = label || '(not set)';
    super(`${role}: ${display}`, vscode.TreeItemCollapsibleState.None);
    this.tooltip = `Click to open workspace settings and edit the ${role.toLowerCase()} task binding`;
    this.iconPath = new vscode.ThemeIcon(label ? 'tag' : 'warning');
    this.description = label ? '' : 'not configured';
    this.command = {
      command: 'workbench.action.openWorkspaceSettings',
      title: 'Open Settings',
      arguments: [`${EXTENSION_ID}.${role.toLowerCase().replace(/\s+/g, '')}TaskLabel`]
    };
    this.contextValue = 'bindingItem';
  }
}

class SectionItem extends vscode.TreeItem {
  /** @param {string} label */
  constructor(label) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'sectionHeader';
  }
}

class ControlPanelProvider {
  constructor() {
    /** @type {vscode.EventEmitter<ControlPanelItem | undefined>} */
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  refresh() {
    this._onDidChangeTreeData.fire(undefined);
  }

  /** @param {ControlPanelItem} [element] */
  getTreeItem(element) {
    return element;
  }

  getChildren() {
    const cfg = vscode.workspace.getConfiguration(EXTENSION_ID);
    const startLabel = cfg.get('startTaskLabel', '');
    const stopLabel = cfg.get('stopTaskLabel', '');
    const healthLabel = cfg.get('healthTaskLabel', '');
    const showHealth = cfg.get('showHealthButton', true);

    const items = [];

    // Action buttons
    items.push(new ControlPanelItem('Start', 'projectLauncher.start', 'play', startLabel || undefined));
    items.push(new ControlPanelItem('Stop', 'projectLauncher.stop', 'primitive-square', stopLabel || undefined));
    items.push(new ControlPanelItem('Restart', 'projectLauncher.restart', 'refresh'));

    if (showHealth && healthLabel) {
      items.push(new ControlPanelItem('Health', 'projectLauncher.healthcheck', 'heart', healthLabel));
    }

    // Separator / section header
    const sep = new SectionItem('Task Bindings');
    sep.iconPath = new vscode.ThemeIcon('list-unordered');
    items.push(sep);

    // Binding items
    items.push(new BindingItem('Start Task', startLabel));
    items.push(new BindingItem('Stop Task', stopLabel));
    if (healthLabel || showHealth) {
      items.push(new BindingItem('Health Task', healthLabel));
    }

    return items;
  }
}

class ActivityProvider {
  constructor() {
    activityChangeEmitter = new vscode.EventEmitter();
    this.onDidChangeTreeData = activityChangeEmitter.event;
  }

  /** @param {ActivityItem} [element] */
  getTreeItem(element) {
    return element;
  }

  getChildren() {
    if (activityLog.length === 0) {
      const empty = new vscode.TreeItem('No activity yet', vscode.TreeItemCollapsibleState.None);
      empty.iconPath = new vscode.ThemeIcon('info');
      return [empty];
    }
    return activityLog;
  }
}

// ---------------------------------------------------------------------------
// Task helpers
// ---------------------------------------------------------------------------

/** @type {vscode.OutputChannel} */
let outputChannel;

/** @param {string} message */
function log(message) {
  const ts = new Date().toISOString();
  outputChannel.appendLine(`[${ts}]  ${message}`);
}

/**
 * Fetch all workspace tasks and find one by label.
 * @param {string} label
 * @returns {Promise<vscode.Task | undefined>}
 */
async function findTaskByLabel(label) {
  if (!label) return undefined;
  const tasks = await vscode.tasks.fetchTasks();
  return tasks.find(t => t.name === label);
}

/**
 * Execute a task by label.  Returns the TaskExecution or undefined.
 * @param {string} label
 * @returns {Promise<vscode.TaskExecution | undefined>}
 */
async function runTaskByLabel(label) {
  const task = await findTaskByLabel(label);
  if (!task) {
    vscode.window.showErrorMessage(`Project Launcher: task "${label}" not found in workspace tasks.`);
    log(`ERROR: task "${label}" not found.`);
    return undefined;
  }
  log(`Running task: ${label}`);
  return vscode.tasks.executeTask(task);
}

/**
 * Terminate any running execution whose task name matches label.
 * @param {string} label
 * @returns {boolean} true if at least one execution was terminated
 */
function terminateTaskByLabel(label) {
  if (!label) return false;
  let found = false;
  for (const exec of vscode.tasks.taskExecutions) {
    if (exec.task.name === label) {
      exec.terminate();
      found = true;
      log(`Terminated running task: ${label}`);
    }
  }
  return found;
}

/**
 * Returns true if the task with the given label is currently running.
 * @param {string} label
 */
function isTaskRunning(label) {
  return vscode.tasks.taskExecutions.some(e => e.task.name === label);
}

// ---------------------------------------------------------------------------
// Status bar
// ---------------------------------------------------------------------------

/** @type {vscode.StatusBarItem[]} */
let statusBarItems = [];

/**
 * @param {string} text
 * @param {string} tooltip
 * @param {string} command
 * @param {number} priority
 */
function createStatusBarItem(text, tooltip, command, priority) {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, priority);
  item.text = text;
  item.tooltip = tooltip;
  item.command = command;
  return item;
}

/** @param {vscode.ExtensionContext} context */
function setupStatusBar(context) {
  const startItem = createStatusBarItem('$(play) Start', 'Project Launcher: Start', 'projectLauncher.start', 100);
  const stopItem = createStatusBarItem('$(primitive-square) Stop', 'Project Launcher: Stop', 'projectLauncher.stop', 99);
  const restartItem = createStatusBarItem('$(refresh) Restart', 'Project Launcher: Restart', 'projectLauncher.restart', 98);
  const healthItem = createStatusBarItem('$(heart) Health', 'Project Launcher: Run Healthcheck', 'projectLauncher.healthcheck', 97);

  statusBarItems = [startItem, stopItem, restartItem, healthItem];
  context.subscriptions.push(...statusBarItems);

  updateStatusBar();
}

function updateStatusBar() {
  const cfg = vscode.workspace.getConfiguration(EXTENSION_ID);
  const show = cfg.get('showStatusBar', true);
  const showHealth = cfg.get('showHealthButton', true);
  const healthLabel = cfg.get('healthTaskLabel', '');

  if (!show) {
    statusBarItems.forEach(i => i.hide());
    return;
  }

  const [startItem, stopItem, restartItem, healthItem] = statusBarItems;
  startItem.show();
  stopItem.show();
  restartItem.show();

  if (showHealth && healthLabel) {
    healthItem.show();
  } else {
    healthItem.hide();
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/** @param {ControlPanelProvider} panelProvider */
async function cmdStart(panelProvider) {
  const cfg = vscode.workspace.getConfiguration(EXTENSION_ID);
  const label = cfg.get('startTaskLabel', '');

  if (!label) {
    const action = await vscode.window.showWarningMessage(
      'Project Launcher: No start task configured.',
      'Open Setup'
    );
    if (action === 'Open Setup') {
      vscode.commands.executeCommand('projectLauncher.setup');
    }
    return;
  }

  if (cfg.get('preventDuplicateStart', true) && isTaskRunning(label)) {
    vscode.window.showInformationMessage(`Project Launcher: "${label}" is already running.`);
    log(`Skipped duplicate start for: ${label}`);
    addActivity(`Skipped (already running): ${label}`, 'warning');
    return;
  }

  log(`Start → ${label}`);
  addActivity(`Started: ${label}`, 'play');
  await runTaskByLabel(label);
  panelProvider.refresh();
}

/** @param {ControlPanelProvider} panelProvider */
async function cmdStop(panelProvider) {
  const cfg = vscode.workspace.getConfiguration(EXTENSION_ID);
  const label = cfg.get('startTaskLabel', '');
  const stopLabel = cfg.get('stopTaskLabel', '');

  // Try to terminate the running start task directly first
  if (label && terminateTaskByLabel(label)) {
    log(`Stop → terminated running task: ${label}`);
    addActivity(`Stopped (terminated): ${label}`, 'primitive-square');
    panelProvider.refresh();
    return;
  }

  // Fall back to running the stop task
  if (stopLabel) {
    log(`Stop → ${stopLabel}`);
    addActivity(`Stopped: ${stopLabel}`, 'primitive-square');
    await runTaskByLabel(stopLabel);
    panelProvider.refresh();
    return;
  }

  vscode.window.showInformationMessage('Project Launcher: No running task to stop and no stop task configured.');
  log('Stop: nothing to stop.');
}

/** @param {ControlPanelProvider} panelProvider */
async function cmdRestart(panelProvider) {
  const cfg = vscode.workspace.getConfiguration(EXTENSION_ID);
  const delay = cfg.get('restartDelayMs', 1000);

  log('Restart → stopping…');
  addActivity('Restart: stopping…', 'refresh');
  await cmdStop(panelProvider);

  await new Promise(resolve => setTimeout(resolve, delay));

  log('Restart → starting…');
  addActivity('Restart: starting…', 'refresh');
  await cmdStart(panelProvider);
}

/** @param {ControlPanelProvider} panelProvider */
async function cmdHealthcheck(panelProvider) {
  const cfg = vscode.workspace.getConfiguration(EXTENSION_ID);
  const label = cfg.get('healthTaskLabel', '');

  if (!label) {
    vscode.window.showWarningMessage('Project Launcher: No health task configured.');
    return;
  }

  log(`Healthcheck → ${label}`);
  addActivity(`Healthcheck: ${label}`, 'heart');
  await runTaskByLabel(label);
  panelProvider.refresh();
}

/**
 * Guided Launcher Setup — picks start, stop, health tasks step by step.
 * @param {ControlPanelProvider} panelProvider
 */
async function cmdSetup(panelProvider) {
  const tasks = await vscode.tasks.fetchTasks();
  const labels = tasks.map(t => t.name);

  if (labels.length === 0) {
    vscode.window.showWarningMessage(
      'Project Launcher: No tasks found in this workspace. Add tasks to .vscode/tasks.json first.'
    );
    return;
  }

  const noneOption = '(none / skip)';
  const picks = [noneOption, ...labels];

  const startPick = await vscode.window.showQuickPick(labels, {
    placeHolder: 'Step 1 of 3 — Select the START task'
  });
  if (startPick === undefined) return;

  const stopPick = await vscode.window.showQuickPick(picks, {
    placeHolder: 'Step 2 of 3 — Select the STOP task (or skip)'
  });
  if (stopPick === undefined) return;

  const healthPick = await vscode.window.showQuickPick(picks, {
    placeHolder: 'Step 3 of 3 — Select the HEALTH task (or skip)'
  });
  if (healthPick === undefined) return;

  const cfg = vscode.workspace.getConfiguration(EXTENSION_ID);
  await cfg.update('startTaskLabel', startPick, vscode.ConfigurationTarget.Workspace);
  await cfg.update('stopTaskLabel', stopPick === noneOption ? '' : stopPick, vscode.ConfigurationTarget.Workspace);
  await cfg.update('healthTaskLabel', healthPick === noneOption ? '' : healthPick, vscode.ConfigurationTarget.Workspace);

  log(`Setup complete. Start="${startPick}", Stop="${stopPick}", Health="${healthPick}"`);
  addActivity('Setup complete', 'gear');
  vscode.window.showInformationMessage('Project Launcher: Setup complete!');
  updateStatusBar();
  panelProvider.refresh();
}

/**
 * Quick Setup — auto-detects likely start/stop/health tasks.
 * @param {ControlPanelProvider} panelProvider
 */
async function cmdQuickSetup(panelProvider) {
  const tasks = await vscode.tasks.fetchTasks();
  const labels = tasks.map(t => t.name.toLowerCase());

  /**
   * @param {string[]} keywords
   * @returns {string | undefined}
   */
  function detect(keywords) {
    const allLabels = tasks.map(t => t.name);
    for (const kw of keywords) {
      const match = allLabels.find(l => l.toLowerCase().includes(kw));
      if (match) return match;
    }
    return undefined;
  }

  const startDetect = detect(['start', 'dev', 'serve', 'run', 'watch', 'develop']);
  const stopDetect = detect(['stop', 'kill', 'down', 'halt']);
  const healthDetect = detect(['health', 'check', 'ping', 'status', 'test']);

  const lines = [
    `Start:  ${startDetect || '(not found)'}`,
    `Stop:   ${stopDetect || '(not found)'}`,
    `Health: ${healthDetect || '(not found)'}`
  ];

  const confirm = await vscode.window.showInformationMessage(
    `Project Launcher Quick Setup detected:\n\n${lines.join('\n')}`,
    { modal: true },
    'Apply',
    'Cancel'
  );

  if (confirm !== 'Apply') return;

  const cfg = vscode.workspace.getConfiguration(EXTENSION_ID);
  await cfg.update('startTaskLabel', startDetect || '', vscode.ConfigurationTarget.Workspace);
  await cfg.update('stopTaskLabel', stopDetect || '', vscode.ConfigurationTarget.Workspace);
  await cfg.update('healthTaskLabel', healthDetect || '', vscode.ConfigurationTarget.Workspace);

  log(`Quick Setup applied. Start="${startDetect}", Stop="${stopDetect}", Health="${healthDetect}"`);
  addActivity('Quick Setup applied', 'zap');
  vscode.window.showInformationMessage('Project Launcher: Quick Setup applied!');
  updateStatusBar();
  panelProvider.refresh();
}

/**
 * Configure Task Labels — quick-pick for individual label settings.
 * @param {ControlPanelProvider} panelProvider
 */
async function cmdConfigureLabels(panelProvider) {
  const tasks = await vscode.tasks.fetchTasks();
  const labels = tasks.map(t => t.name);

  if (labels.length === 0) {
    vscode.window.showWarningMessage(
      'Project Launcher: No tasks found. Add tasks to .vscode/tasks.json first.'
    );
    return;
  }

  const roles = ['startTaskLabel', 'stopTaskLabel', 'healthTaskLabel'];
  const roleNames = ['Start Task', 'Stop Task', 'Health Task'];
  const noneOption = '(none / clear)';

  const cfg = vscode.workspace.getConfiguration(EXTENSION_ID);

  for (let i = 0; i < roles.length; i++) {
    const current = cfg.get(roles[i], '');
    const pick = await vscode.window.showQuickPick([noneOption, ...labels], {
      placeHolder: `${roleNames[i]} — current: "${current || 'not set'}"`,
      title: `Configure ${roleNames[i]}`
    });
    if (pick === undefined) return;
    await cfg.update(roles[i], pick === noneOption ? '' : pick, vscode.ConfigurationTarget.Workspace);
  }

  addActivity('Labels configured', 'tag');
  vscode.window.showInformationMessage('Project Launcher: Task labels updated.');
  updateStatusBar();
  panelProvider.refresh();
}

// ---------------------------------------------------------------------------
// Extension entry points
// ---------------------------------------------------------------------------

/** @param {vscode.ExtensionContext} context */
function activate(context) {
  // Output channel
  outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  context.subscriptions.push(outputChannel);
  log('Project Launcher activated.');

  // Tree providers
  const panelProvider = new ControlPanelProvider();
  const activityProvider = new ActivityProvider();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('projectLauncherControlPanel', panelProvider),
    vscode.window.registerTreeDataProvider('projectLauncherActivity', activityProvider)
  );

  // Status bar
  setupStatusBar(context);

  // Listen to configuration changes to update status bar & panel
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration(EXTENSION_ID)) {
        updateStatusBar();
        panelProvider.refresh();
      }
    })
  );

  // Listen to task events for activity log
  context.subscriptions.push(
    vscode.tasks.onDidStartTask(e => {
      const label = e.execution.task.name;
      log(`Task started: ${label}`);
      addActivity(`Task started: ${label}`, 'play-circle');
    }),
    vscode.tasks.onDidEndTask(e => {
      const label = e.execution.task.name;
      log(`Task ended: ${label}`);
      addActivity(`Task ended: ${label}`, 'check');
    }),
    vscode.tasks.onDidStartTaskProcess(e => {
      log(`Task process started (PID ${e.processId}): ${e.execution.task.name}`);
    }),
    vscode.tasks.onDidEndTaskProcess(e => {
      const label = e.execution.task.name;
      const code = e.exitCode;
      log(`Task process ended (exit ${code}): ${label}`);
      if (code !== 0) {
        addActivity(`Task exited with code ${code}: ${label}`, 'error');
      }
    })
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('projectLauncher.start', () => cmdStart(panelProvider)),
    vscode.commands.registerCommand('projectLauncher.stop', () => cmdStop(panelProvider)),
    vscode.commands.registerCommand('projectLauncher.restart', () => cmdRestart(panelProvider)),
    vscode.commands.registerCommand('projectLauncher.healthcheck', () => cmdHealthcheck(panelProvider)),
    vscode.commands.registerCommand('projectLauncher.setup', () => cmdSetup(panelProvider)),
    vscode.commands.registerCommand('projectLauncher.quickSetup', () => cmdQuickSetup(panelProvider)),
    vscode.commands.registerCommand('projectLauncher.refresh', () => {
      panelProvider.refresh();
      addActivity('Refreshed', 'sync');
    }),
    vscode.commands.registerCommand('projectLauncher.showOutput', () => {
      outputChannel.show();
    }),
    vscode.commands.registerCommand('projectLauncher.clearActivity', () => {
      activityLog = [];
      if (activityChangeEmitter) activityChangeEmitter.fire(undefined);
      log('Activity log cleared.');
    }),
    vscode.commands.registerCommand('projectLauncher.configureLabels', () => cmdConfigureLabels(panelProvider))
  );

  addActivity('Project Launcher ready', 'rocket');
}

function deactivate() {
  if (outputChannel) {
    outputChannel.dispose();
  }
}

module.exports = { activate, deactivate };
