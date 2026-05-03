# Project Launcher for VS Code

Project Launcher is a lightweight VS Code extension for teams and solo developers who want one-click task control without paid task dashboards.

It adds a dedicated sidebar control panel, an activity log, an output channel, and status bar buttons by reusing normal workspace tasks from `.vscode/tasks.json`.

---

## Features

- **Dedicated Activity Bar container** with a Control Panel view
- **Separate Activity view** with recent task events
- **Output channel** for start, stop, restart, and healthcheck logs
- **Start, Stop, and Restart controls** in both sidebar and status bar
- **Optional Health control**
- **Guided setup menu** instead of a raw three-step task picker flow
- **Quick Setup** that auto-detects likely start, stop, and health tasks
- **Clickable configured task bindings** in the sidebar for direct editing
- Reuses existing workspace tasks instead of introducing a custom process model
- Stops running tasks through the VS Code Task API when possible
- Workspace-level configuration so the same extension can be reused across many similar repositories
- Quick command to bind task labels without editing JSON manually

---

## Commands

| Command | Description |
|---------|-------------|
| `Project Launcher: Start` | Run the configured start task |
| `Project Launcher: Stop` | Terminate the running task or run the stop task |
| `Project Launcher: Restart` | Stop, wait, then start again |
| `Project Launcher: Run Healthcheck` | Run the configured health task |
| `Project Launcher: Launcher Setup` | Guided three-step task picker |
| `Project Launcher: Quick Setup` | Auto-detect and apply start/stop/health tasks |
| `Project Launcher: Refresh` | Refresh the Control Panel sidebar |
| `Project Launcher: Show Output` | Open the Project Launcher output channel |
| `Project Launcher: Clear Activity` | Clear the Activity sidebar log |
| `Project Launcher: Configure Task Labels` | Interactively bind task labels |

---

## Install From VSIX

The packaged VSIX can be installed via:

> **Extensions: Install from VSIX…**

---

## Recommended Workspace Configuration

```json
{
  "projectLauncher.startTaskLabel": "Dev: start local app",
  "projectLauncher.stopTaskLabel": "Dev: stop local app",
  "projectLauncher.healthTaskLabel": "Dev: healthcheck"
}
```

You can also run **Project Launcher: Configure Task Labels** and select the task labels interactively.

---

## Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `projectLauncher.startTaskLabel` | string | `""` | Task label executed by Start |
| `projectLauncher.stopTaskLabel` | string | `""` | Task label executed by Stop when there is no running execution to terminate directly |
| `projectLauncher.healthTaskLabel` | string | `""` | Optional task label for the Health command/button |
| `projectLauncher.showStatusBar` | boolean | `true` | Show or hide all launcher buttons in the status bar |
| `projectLauncher.showHealthButton` | boolean | `true` | Show the Health button when a health task is configured |
| `projectLauncher.preventDuplicateStart` | boolean | `true` | Avoid launching the same start task twice |
| `projectLauncher.restartDelayMs` | number | `1000` | Delay in milliseconds between stop and start during restart |
| `projectLauncher.activityItemLimit` | number | `50` | Maximum number of recent entries in the Activity sidebar view |

---

## Development

To run the extension in an Extension Development Host:

1. Open `tools/vscode-project-launcher` in VS Code.
2. Press **F5**.

To package a new VSIX:

```bash
cd tools/vscode-project-launcher
npx @vscode/vsce package
```

---

## Release Flow

This repository includes a release-ready GitHub Actions setup:

- **`.github/workflows/ci.yml`** — validates `extension.js` and packages a VSIX on pushes and pull requests
- **`.github/workflows/release.yml`** — packages the VSIX on version tags and uploads it to the GitHub Release

See [PUBLISHING.md](./PUBLISHING.md) for the minimal repository and secret setup required before first publication.
