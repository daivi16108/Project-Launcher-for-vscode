'use strict'

const vscode = require('vscode')

const CONFIG_NS = 'projectLauncher'
const VIEW_IDS = {
  control: 'projectLauncher.view.controlPanel',
  activity: 'projectLauncher.view.activity',
}
const COMMANDS = {
  start: 'projectLauncher.start',
  stop: 'projectLauncher.stop',
  restart: 'projectLauncher.restart',
  health: 'projectLauncher.runHealthcheck',
  configure: 'projectLauncher.configure',
  quickSetup: 'projectLauncher.quickSetup',
  editBinding: 'projectLauncher.editBinding',
  refresh: 'projectLauncher.refresh',
  showOutput: 'projectLauncher.showOutput',
  clearActivity: 'projectLauncher.clearActivity',
}
const CONFIG_CANCELLED = Symbol('projectLauncher.configure.cancelled')
const TASK_BINDINGS = [
  { key: 'startTaskLabel', title: 'Start task', prompt: 'Choose the task that starts your app', required: true, role: 'start' },
  { key: 'stopTaskLabel', title: 'Stop task', prompt: 'Choose the task that stops your app', required: false, role: 'stop' },
  { key: 'healthTaskLabel', title: 'Health task', prompt: 'Choose the healthcheck task', required: false, role: 'health' },
]

let extensionState = null

class LauncherTreeItem extends vscode.TreeItem {
  constructor(id, label, options = {}) {
    super(label, options.collapsibleState ?? vscode.TreeItemCollapsibleState.None)
    this.id = id
    this.contextValue = options.contextValue || 'projectLauncher.item'
    this.description = options.description
    this.tooltip = options.tooltip
    this.command = options.command
    this.iconPath = options.icon ? new vscode.ThemeIcon(options.icon) : undefined
  }
}

class LauncherControlProvider {
  constructor(state) {
    this.state = state
    this._onDidChangeTreeData = new vscode.EventEmitter()
    this.onDidChangeTreeData = this._onDidChangeTreeData.event
  }

  dispose() {
    this._onDidChangeTreeData.dispose()
  }

  refresh() {
    this._onDidChangeTreeData.fire()
  }

  getTreeItem(item) {
    return item
  }

  getChildren(item) {
    if (!item) {
      return [
        this.createSection('actions', 'Actions'),
        this.createSection('status', 'Status'),
        this.createSection('tasks', 'Configured Tasks'),
      ]
    }

    switch (item.id) {
      case 'actions':
        return this.getActionItems()
      case 'status':
        return this.getStatusItems()
      case 'tasks':
        return this.getTaskItems()
      default:
        return []
    }
  }

  createSection(id, label) {
    return new LauncherTreeItem(id, label, {
      collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
      contextValue: 'projectLauncher.section',
    })
  }

  getActionItems() {
    const setupReady = isSetupReady()
    const items = [
      this.createCommandItem('action-start', 'Start App', COMMANDS.start, 'play', 'Run the configured start task'),
      this.createCommandItem('action-stop', 'Stop App', COMMANDS.stop, 'debug-stop', 'Stop the running task or execute the configured stop task'),
      this.createCommandItem('action-restart', 'Restart App', COMMANDS.restart, 'refresh', 'Restart the configured start task'),
    ]

    if (getSetting('healthTaskLabel', '')) {
      items.push(this.createCommandItem('action-health', 'Run Healthcheck', COMMANDS.health, 'pulse', 'Run the configured healthcheck task'))
    }

    items.push(
      this.createCommandItem('action-configure', setupReady ? 'Launcher Setup' : 'Finish Setup', COMMANDS.configure, 'gear', setupReady ? 'Adjust launcher bindings and preferences' : 'Complete setup for this workspace'),
      this.createCommandItem('action-quick-setup', 'Use Recommended Tasks', COMMANDS.quickSetup, 'sparkle', 'Auto-detect common start, stop and health tasks for this workspace'),
      this.createCommandItem('action-output', 'Open Output Channel', COMMANDS.showOutput, 'output', 'Open the Project Launcher output channel'),
      this.createCommandItem('action-refresh', 'Refresh Panel', COMMANDS.refresh, 'sync', 'Refresh control and activity views')
    )

    return items
  }

  getStatusItems() {
    const runningStart = isConfiguredTaskRunning('startTaskLabel')
    const healthConfigured = !!getSetting('healthTaskLabel', '')
    const lastEvent = this.state.lastEvent
    const items = [
      new LauncherTreeItem('status-setup', 'Setup status', {
        description: isSetupReady() ? 'ready' : 'needs attention',
        icon: isSetupReady() ? 'pass' : 'warning',
        tooltip: isSetupReady() ? 'Start task is configured. You can launch the app.' : 'The launcher still needs at least a start task. Run Finish Setup or Use Recommended Tasks.',
        command: isSetupReady() ? undefined : { command: COMMANDS.configure, title: 'Finish Setup' },
      }),
      new LauncherTreeItem('status-current-state', runningStart ? 'Application is running' : 'Application is idle', {
        description: runningStart ? 'start task active' : getIdleStateText(),
        icon: runningStart ? 'play-circle' : isRestartInProgress() ? 'sync~spin' : 'circle-large-outline',
        tooltip: runningStart ? 'The configured start task currently has a running execution.' : 'No running execution for the configured start task was found.',
      }),
      new LauncherTreeItem('status-running-count', 'Running task executions', {
        description: String(vscode.tasks.taskExecutions.length),
        icon: vscode.tasks.taskExecutions.length > 0 ? 'pulse' : 'dash',
        tooltip: `Currently running task executions in VS Code: ${vscode.tasks.taskExecutions.length}`,
      }),
      new LauncherTreeItem('status-health', 'Health command', {
        description: healthConfigured ? 'configured' : 'not configured',
        icon: healthConfigured ? 'heart' : 'circle-slash',
        tooltip: healthConfigured ? `Health task label: ${getSetting('healthTaskLabel', '')}` : 'Set projectLauncher.healthTaskLabel to enable health checks.',
      }),
    ]

    if (lastEvent) {
      items.push(new LauncherTreeItem('status-last-event', 'Last event', {
        description: formatTimestamp(lastEvent.timestamp),
        tooltip: `${lastEvent.message}${lastEvent.detail ? `\n${lastEvent.detail}` : ''}`,
        icon: iconForLevel(lastEvent.level),
      }))
    }

    return items
  }

  getTaskItems() {
    return [
      this.createTaskInfoItem('task-start', 'Start task', 'startTaskLabel'),
      this.createTaskInfoItem('task-stop', 'Stop task', 'stopTaskLabel'),
      this.createTaskInfoItem('task-health', 'Health task', 'healthTaskLabel'),
    ]
  }

  createTaskInfoItem(id, label, key) {
    const value = getSetting(key, '')
    const binding = getBindingDefinition(key)
    return new LauncherTreeItem(id, label, {
      description: value || 'not configured',
      tooltip: value ? `${value}\nClick to change this binding.` : `Set ${CONFIG_NS}.${key} in workspace settings or run Project Launcher setup.`,
      icon: value ? 'tasklist' : 'circle-slash',
      contextValue: 'projectLauncher.binding',
      command: binding ? {
        command: COMMANDS.editBinding,
        title: `Change ${label}`,
        arguments: [key],
      } : undefined,
    })
  }

  createCommandItem(id, label, commandName, icon, tooltip) {
    return new LauncherTreeItem(id, label, {
      icon,
      tooltip,
      contextValue: 'projectLauncher.command',
      command: {
        command: commandName,
        title: label,
      },
    })
  }
}

class LauncherActivityProvider {
  constructor(state) {
    this.state = state
    this._onDidChangeTreeData = new vscode.EventEmitter()
    this.onDidChangeTreeData = this._onDidChangeTreeData.event
  }

  dispose() {
    this._onDidChangeTreeData.dispose()
  }

  refresh() {
    this._onDidChangeTreeData.fire()
  }

  getTreeItem(item) {
    return item
  }

  getChildren(item) {
    if (item) return []

    const items = [
      new LauncherTreeItem('activity-open-output', 'Open Output Channel', {
        icon: 'output',
        command: { command: COMMANDS.showOutput, title: 'Open Output Channel' },
        contextValue: 'projectLauncher.command',
      }),
      new LauncherTreeItem('activity-clear', 'Clear Activity', {
        icon: 'clear-all',
        command: { command: COMMANDS.clearActivity, title: 'Clear Activity' },
        contextValue: 'projectLauncher.command',
      }),
    ]

    if (!this.state.activityLog.length) {
      items.push(new LauncherTreeItem('activity-empty', 'No activity yet', {
        description: 'Run a launcher command to populate this view',
        icon: 'clock',
      }))
      return items
    }

    return items.concat(this.state.activityLog.map((entry) => new LauncherTreeItem(entry.id, entry.message, {
      description: formatTimestamp(entry.timestamp),
      tooltip: `${entry.message}${entry.detail ? `\n${entry.detail}` : ''}`,
      icon: iconForLevel(entry.level),
      contextValue: 'projectLauncher.log',
    })))
  }
}

function createState(context) {
  return {
    context,
    statusItems: [],
    output: vscode.window.createOutputChannel('Project Launcher'),
    activityLog: [],
    lastEvent: null,
    restartInProgress: false,
    controlProvider: null,
    activityProvider: null,
    controlView: null,
    activityView: null,
  }
}

function getConfig() {
  return vscode.workspace.getConfiguration(CONFIG_NS)
}

function getSetting(key, fallback) {
  return getConfig().get(key, fallback)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function alignmentFromConfig(value) {
  return value === 'right' ? vscode.StatusBarAlignment.Right : vscode.StatusBarAlignment.Left
}

function taskScopeName(task) {
  const scope = task?.scope
  return scope && typeof scope === 'object' && scope.name ? scope.name : ''
}

function taskLabels(task) {
  const labels = [
    task?.name,
    task?.definition?.label,
    task?.detail,
    task?.source && task?.name ? `${task.source}: ${task.name}` : null,
  ].filter(Boolean)

  return [...new Set(labels)]
}

function getBindingDefinition(key) {
  return TASK_BINDINGS.find((binding) => binding.key === key) || null
}

function getSetupSummary() {
  const startTaskLabel = getSetting('startTaskLabel', '')
  const stopTaskLabel = getSetting('stopTaskLabel', '')
  const healthTaskLabel = getSetting('healthTaskLabel', '')

  return {
    startTaskLabel,
    stopTaskLabel,
    healthTaskLabel,
    ready: Boolean(startTaskLabel),
  }
}

function isSetupReady() {
  return getSetupSummary().ready
}

function getTaskQuickPicks(tasks, currentValue, allowClear = true) {
  const picks = tasks
    .map((task) => {
      const labels = taskLabels(task)
      const scopeName = taskScopeName(task)
      return {
        label: labels[0],
        description: [task.source || '', scopeName || '', labels[0] === currentValue ? 'current' : ''].filter(Boolean).join(' • '),
        detail: labels.slice(1).join(' | '),
      }
    })
    .filter((pick) => pick.label)
    .sort((left, right) => left.label.localeCompare(right.label))

  if (allowClear) {
    picks.unshift({ label: '', description: 'Clear value', detail: '' })
  }

  return picks
}

function keywordScore(label, keywords) {
  return keywords.reduce((score, keyword) => {
    if (label === keyword) return score + 120
    if (label.startsWith(keyword)) return score + 80
    if (label.includes(keyword)) return score + 40
    return score
  }, 0)
}

function detectRecommendedTaskLabels(tasks) {
  const keywordGroups = {
    start: ['start', 'run', 'serve', 'dev', 'launch', 'up'],
    stop: ['stop', 'down', 'kill', 'shutdown', 'terminate'],
    health: ['health', 'check', 'ping', 'smoke'],
  }
  const ranked = { start: null, stop: null, health: null }

  tasks.forEach((task) => {
    const label = primaryTaskLabel(task)
    const lowered = label.toLowerCase()
    for (const role of Object.keys(keywordGroups)) {
      const score = keywordScore(lowered, keywordGroups[role])
      if (!score) continue
      if (!ranked[role] || score > ranked[role].score) {
        ranked[role] = { label, score }
      }
    }
  })

  return {
    startTaskLabel: ranked.start?.label || '',
    stopTaskLabel: ranked.stop?.label || '',
    healthTaskLabel: ranked.health?.label || '',
  }
}

async function updateBinding(key, value) {
  await getConfig().update(key, value, vscode.ConfigurationTarget.Workspace)
}

async function applyTaskBindings(bindings, options = {}) {
  for (const binding of TASK_BINDINGS) {
    if (Object.prototype.hasOwnProperty.call(bindings, binding.key)) {
      await updateBinding(binding.key, bindings[binding.key])
    }
  }

  const summary = getSetupSummary()
  if (summary.ready) {
    logActivity('success', options.message || 'Launcher setup updated')
  } else {
    logActivity('warn', options.message || 'Launcher setup updated, but start task is still missing')
  }
  refreshViews()
}

function primaryTaskLabel(task) {
  return taskLabels(task)[0] || 'Unknown task'
}

function matchesTaskLabel(task, label) {
  return Boolean(label) && taskLabels(task).includes(label)
}

async function findTask(label) {
  if (!label) return null
  const tasks = await vscode.tasks.fetchTasks()
  return tasks.find((task) => matchesTaskLabel(task, label)) || null
}

function findExecutions(label) {
  if (!label) return []
  return vscode.tasks.taskExecutions.filter((execution) => matchesTaskLabel(execution.task, label))
}

function isConfiguredTaskRunning(configKey) {
  return findExecutions(getSetting(configKey, '')).length > 0
}

function isRestartInProgress() {
  return Boolean(extensionState?.restartInProgress)
}

function getIdleStateText() {
  return isRestartInProgress() ? 'restart in progress' : 'waiting for start'
}

function formatTimestamp(value) {
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function iconForLevel(level) {
  switch (level) {
    case 'error':
      return 'error'
    case 'warn':
      return 'warning'
    case 'success':
      return 'pass'
    default:
      return 'info'
  }
}

function refreshStatusBar() {
  if (!extensionState) return
  disposeStatusItems()

  if (!getSetting('showStatusBar', true)) return

  const alignment = alignmentFromConfig(getSetting('statusBarAlignment', 'left'))
  const priority = Number(getSetting('statusBarPriority', 1000))
  const running = isConfiguredTaskRunning('startTaskLabel')
  const startTaskLabel = getSetting('startTaskLabel', '')
  const stopTaskLabel = getSetting('stopTaskLabel', '')
  const healthTaskLabel = getSetting('healthTaskLabel', '')

  const startItem = vscode.window.createStatusBarItem(alignment, priority)
  startItem.command = COMMANDS.start
  startItem.text = extensionState.restartInProgress
    ? '$(sync~spin) Restarting App'
    : running
      ? getSetting('runningText', '$(sync~spin) App Running')
      : getSetting('startText', '$(play) Start App')
  startItem.tooltip = startTaskLabel ? `Start task: ${startTaskLabel}` : 'Configure projectLauncher.startTaskLabel'
  startItem.show()

  const stopItem = vscode.window.createStatusBarItem(alignment, priority - 1)
  stopItem.command = COMMANDS.stop
  stopItem.text = getSetting('stopText', '$(debug-stop) Stop App')
  stopItem.tooltip = stopTaskLabel ? `Stop task: ${stopTaskLabel}` : 'Stop running start task or configure projectLauncher.stopTaskLabel'
  stopItem.show()

  const restartItem = vscode.window.createStatusBarItem(alignment, priority - 2)
  restartItem.command = COMMANDS.restart
  restartItem.text = getSetting('restartText', '$(refresh) Restart App')
  restartItem.tooltip = startTaskLabel ? `Restart task: ${startTaskLabel}` : 'Configure projectLauncher.startTaskLabel'
  restartItem.show()

  extensionState.statusItems = [startItem, stopItem, restartItem]

  if (getSetting('showHealthButton', true) && healthTaskLabel) {
    const healthItem = vscode.window.createStatusBarItem(alignment, priority - 3)
    healthItem.command = COMMANDS.health
    healthItem.text = getSetting('healthText', '$(pulse) Health')
    healthItem.tooltip = `Health task: ${healthTaskLabel}`
    healthItem.show()
    extensionState.statusItems.push(healthItem)
  }
}

function refreshViews() {
  refreshStatusBar()
  extensionState?.controlProvider?.refresh()
  extensionState?.activityProvider?.refresh()
}

function logActivity(level, message, detail = '') {
  if (!extensionState) return
  const timestamp = Date.now()
  const entry = {
    id: `${timestamp}-${Math.random().toString(16).slice(2, 8)}`,
    level,
    message,
    detail,
    timestamp,
  }

  extensionState.activityLog.unshift(entry)
  extensionState.activityLog = extensionState.activityLog.slice(0, Number(getSetting('activityItemLimit', 50)))
  extensionState.lastEvent = entry
  extensionState.output.appendLine(`[${new Date(timestamp).toISOString()}] ${level.toUpperCase()} ${message}${detail ? ` :: ${detail}` : ''}`)
  refreshViews()
}

async function runTask(label, options = {}) {
  const opts = {
    preventDuplicate: false,
    silent: false,
    ...options,
  }

  if (!label) {
    logActivity('warn', 'Task label is not configured')
    if (!opts.silent) {
      vscode.window.showWarningMessage('Project Launcher: task label is not configured.')
    }
    return null
  }

  if (opts.preventDuplicate && findExecutions(label).length > 0) {
    logActivity('info', 'Task already running', label)
    if (!opts.silent) {
      vscode.window.showInformationMessage(`Project Launcher: task "${label}" is already running.`)
    }
    return null
  }

  const task = await findTask(label)
  if (!task) {
    logActivity('error', 'Configured task not found', label)
    vscode.window.showErrorMessage(`Project Launcher: task "${label}" not found in this workspace.`)
    return null
  }

  logActivity('info', 'Executing task', label)
  return vscode.tasks.executeTask(task)
}

function terminateExecutions(label) {
  const executions = findExecutions(label)
  executions.forEach((execution) => execution.terminate())
  return executions.length
}

async function waitForExecutionsToEnd(label, timeoutMs = 2000) {
  const startedAt = Date.now()
  while (findExecutions(label).length > 0 && Date.now() - startedAt < timeoutMs) {
    await sleep(100)
  }
}

async function stopConfiguredTask() {
  const startTaskLabel = getSetting('startTaskLabel', '')
  const stopTaskLabel = getSetting('stopTaskLabel', '')

  const stoppedStart = terminateExecutions(startTaskLabel)
  const stoppedStop = startTaskLabel !== stopTaskLabel ? terminateExecutions(stopTaskLabel) : 0
  if (stoppedStart || stoppedStop) {
    logActivity('info', 'Terminated running task execution', `${stoppedStart + stoppedStop} execution(s)`)
    return true
  }

  if (stopTaskLabel) {
    logActivity('info', 'Running configured stop task', stopTaskLabel)
    await runTask(stopTaskLabel, { silent: true })
    return true
  }

  logActivity('warn', 'Nothing to stop', 'No running task and no stop task configured')
  vscode.window.showInformationMessage('Project Launcher: nothing is running and no stop task is configured.')
  return false
}

function disposeStatusItems() {
  if (!extensionState) return
  while (extensionState.statusItems.length) {
    extensionState.statusItems.pop().dispose()
  }
}

async function chooseTask(placeHolder) {
  const tasks = await vscode.tasks.fetchTasks()
  const selection = await vscode.window.showQuickPick(getTaskQuickPicks(tasks, ''), {
    placeHolder,
    title: 'Project Launcher',
    ignoreFocusOut: true,
  })

  if (!selection) return CONFIG_CANCELLED
  return selection.label
}

async function chooseTaskForBinding(bindingKey) {
  const binding = getBindingDefinition(bindingKey)
  if (!binding) return CONFIG_CANCELLED

  const currentValue = getSetting(bindingKey, '')
  const tasks = await vscode.tasks.fetchTasks()
  const selection = await vscode.window.showQuickPick(getTaskQuickPicks(tasks, currentValue, !binding.required), {
    title: `Project Launcher: ${binding.title}`,
    placeHolder: binding.prompt,
    ignoreFocusOut: true,
  })

  if (!selection) return CONFIG_CANCELLED
  return selection.label
}

async function quickSetupTasks() {
  const tasks = await vscode.tasks.fetchTasks()
  if (!tasks.length) {
    vscode.window.showWarningMessage('Project Launcher: no workspace tasks were found.')
    return
  }

  const recommended = detectRecommendedTaskLabels(tasks)
  if (!recommended.startTaskLabel) {
    vscode.window.showWarningMessage('Project Launcher: could not detect a start task automatically. Use Launcher Setup instead.')
    return
  }

  const selection = await vscode.window.showInformationMessage(
    `Use detected tasks? Start: ${recommended.startTaskLabel}${recommended.stopTaskLabel ? `, Stop: ${recommended.stopTaskLabel}` : ''}${recommended.healthTaskLabel ? `, Health: ${recommended.healthTaskLabel}` : ''}`,
    { modal: true },
    'Use Recommended Tasks',
    'Review First'
  )

  if (!selection) return
  if (selection === 'Review First') {
    await configureTasks()
    return
  }

  await applyTaskBindings(recommended, { message: 'Recommended tasks applied' })
}

async function configureTasks() {
  const setup = getSetupSummary()
  const selection = await vscode.window.showQuickPick([
    {
      label: 'Quick setup with recommended tasks',
      description: 'Try to auto-fill start, stop and health tasks',
      detail: setup.ready ? `Current start task: ${setup.startTaskLabel}` : 'Recommended for first-time setup',
      action: 'quickSetup',
    },
    {
      label: 'Change Start task',
      description: setup.startTaskLabel || 'Not configured',
      detail: 'Required for Start and Restart actions',
      action: 'edit:startTaskLabel',
    },
    {
      label: 'Change Stop task',
      description: setup.stopTaskLabel || 'Not configured',
      detail: 'Optional. Used when there is no running execution to terminate directly.',
      action: 'edit:stopTaskLabel',
    },
    {
      label: 'Change Health task',
      description: setup.healthTaskLabel || 'Not configured',
      detail: 'Optional. Enables the Health action and status bar button.',
      action: 'edit:healthTaskLabel',
    },
    {
      label: 'Reset all task bindings',
      description: 'Clear start, stop and health task labels',
      detail: 'Useful when switching this workspace to another project shape.',
      action: 'reset',
    },
  ], {
    title: 'Project Launcher Setup',
    placeHolder: 'Choose what you want to change',
    ignoreFocusOut: true,
  })

  if (!selection) return

  if (selection.action === 'quickSetup') {
    await quickSetupTasks()
    return
  }

  if (selection.action === 'reset') {
    const confirm = await vscode.window.showWarningMessage(
      'Clear all Project Launcher task bindings for this workspace?',
      { modal: true },
      'Reset'
    )
    if (confirm === 'Reset') {
      await applyTaskBindings({
        startTaskLabel: '',
        stopTaskLabel: '',
        healthTaskLabel: '',
      }, { message: 'Task bindings cleared' })
    }
    return
  }

  if (selection.action.startsWith('edit:')) {
    await editTaskBinding(selection.action.slice(5))
  }
}

async function editTaskBinding(bindingKey) {
  const binding = getBindingDefinition(bindingKey)
  if (!binding) return

  const chosenLabel = await chooseTaskForBinding(bindingKey)
  if (chosenLabel === CONFIG_CANCELLED) return

  if (binding.required && !chosenLabel) {
    vscode.window.showWarningMessage('Project Launcher: Start task cannot be empty.')
    return
  }

  await updateBinding(bindingKey, chosenLabel)
  logActivity('success', `${binding.title} updated`, chosenLabel || 'cleared')
  refreshViews()
}

function clearActivity() {
  if (!extensionState) return
  extensionState.activityLog = []
  extensionState.lastEvent = null
  extensionState.output.clear()
  refreshViews()
}

function showOutput() {
  extensionState?.output.show(true)
}

function classifyTask(task) {
  const label = primaryTaskLabel(task)
  if (matchesTaskLabel(task, getSetting('startTaskLabel', ''))) return `start:${label}`
  if (matchesTaskLabel(task, getSetting('stopTaskLabel', ''))) return `stop:${label}`
  if (matchesTaskLabel(task, getSetting('healthTaskLabel', ''))) return `health:${label}`
  return `task:${label}`
}

function activate(context) {
  extensionState = createState(context)
  extensionState.controlProvider = new LauncherControlProvider(extensionState)
  extensionState.activityProvider = new LauncherActivityProvider(extensionState)
  extensionState.controlView = vscode.window.createTreeView(VIEW_IDS.control, {
    treeDataProvider: extensionState.controlProvider,
    showCollapseAll: false,
  })
  extensionState.activityView = vscode.window.createTreeView(VIEW_IDS.activity, {
    treeDataProvider: extensionState.activityProvider,
    showCollapseAll: false,
  })

  context.subscriptions.push(
    extensionState.output,
    extensionState.controlProvider,
    extensionState.activityProvider,
    extensionState.controlView,
    extensionState.activityView,
    vscode.commands.registerCommand(COMMANDS.start, async () => {
      await runTask(getSetting('startTaskLabel', ''), {
        preventDuplicate: getSetting('preventDuplicateStart', true),
      })
      refreshViews()
    }),
    vscode.commands.registerCommand(COMMANDS.stop, async () => {
      await stopConfiguredTask()
      refreshViews()
    }),
    vscode.commands.registerCommand(COMMANDS.restart, async () => {
      const label = getSetting('startTaskLabel', '')
      if (!label) {
        vscode.window.showWarningMessage('Project Launcher: start task label is not configured.')
        return
      }

      extensionState.restartInProgress = true
      logActivity('info', 'Restart requested', label)
      refreshViews()
      try {
        await stopConfiguredTask()
        await waitForExecutionsToEnd(label)
        await sleep(Number(getSetting('restartDelayMs', 350)))
        await runTask(label, { silent: true })
      } finally {
        extensionState.restartInProgress = false
        refreshViews()
      }
    }),
    vscode.commands.registerCommand(COMMANDS.health, async () => {
      await runTask(getSetting('healthTaskLabel', ''))
      refreshViews()
    }),
    vscode.commands.registerCommand(COMMANDS.configure, configureTasks),
    vscode.commands.registerCommand(COMMANDS.quickSetup, quickSetupTasks),
    vscode.commands.registerCommand(COMMANDS.editBinding, editTaskBinding),
    vscode.commands.registerCommand(COMMANDS.refresh, () => {
      logActivity('info', 'Manual refresh')
      refreshViews()
    }),
    vscode.commands.registerCommand(COMMANDS.showOutput, showOutput),
    vscode.commands.registerCommand(COMMANDS.clearActivity, () => {
      extensionState?.output.clear()
      clearActivity()
      logActivity('info', 'Activity log cleared')
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(CONFIG_NS)) {
        logActivity('info', 'Configuration changed')
        refreshViews()
      }
    }),
    vscode.tasks.onDidStartTask((event) => {
      logActivity('info', 'Task started', classifyTask(event.execution.task))
    }),
    vscode.tasks.onDidStartTaskProcess((event) => {
      logActivity('info', 'Task process started', `${classifyTask(event.execution.task)} • pid ${event.processId}`)
    }),
    vscode.tasks.onDidEndTaskProcess((event) => {
      const level = event.exitCode === 0 ? 'success' : 'warn'
      logActivity(level, 'Task process ended', `${classifyTask(event.execution.task)} • exit ${event.exitCode}`)
    }),
    vscode.tasks.onDidEndTask((event) => {
      logActivity('info', 'Task ended', classifyTask(event.execution.task))
    }),
    { dispose: disposeStatusItems }
  )

  logActivity('success', 'Project Launcher activated')
}

function deactivate() {
  disposeStatusItems()
  extensionState = null
}

module.exports = {
  activate,
  deactivate,
}