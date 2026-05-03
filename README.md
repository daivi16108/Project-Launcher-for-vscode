# Project Launcher Buttons

Project Launcher Buttons turns existing VS Code tasks into one-click controls for local development workflows.

![Project Launcher icon](media/icon.png)

Instead of maintaining another process manager, you can reuse the tasks you already have in `.vscode/tasks.json` and expose them as Start, Stop, Restart, and Health actions in the sidebar and status bar.

## Why Use It

- Reuse existing tasks instead of introducing another dev workflow tool
- Start and stop local apps from one place in the VS Code UI
- Keep recent activity and task output visible when something fails
- Set up a workspace in a minute with guided binding or quick detection

## Good Fit For

- full-stack repositories with separate frontend and backend tasks
- local dev environments with start, stop, and smoke-check commands
- teams that want a lightweight shared workflow without custom scripts

## Quick Start

1. Open a workspace that already defines tasks in `.vscode/tasks.json`.
2. Run `Project Launcher: Quick Setup` or `Project Launcher: Launcher Setup`.
3. Bind your start, stop, and optional healthcheck tasks.
4. Use the sidebar or status bar controls to run the workflow.

## Features

- Dedicated Activity Bar container with a Control Panel view
- Separate Activity view with recent task events
- Output channel for start, stop, restart, and healthcheck logs
- Start, Stop, and Restart controls in both sidebar and status bar
- Optional Health control
- Guided setup menu instead of a raw three-step task picker flow
- Quick Setup that auto-detects likely start, stop, and health tasks
- Clickable configured task bindings in the sidebar for direct editing
- Reuses existing workspace tasks instead of introducing a custom process model
- Stops running tasks through the VS Code Task API when possible
- Workspace-level configuration so the same extension can be reused across many similar repositories

## Commands

- `Project Launcher: Start`
- `Project Launcher: Stop`
- `Project Launcher: Restart`
- `Project Launcher: Run Healthcheck`
- `Project Launcher: Launcher Setup`
- `Project Launcher: Quick Setup`
- `Project Launcher: Refresh`
- `Project Launcher: Show Output`
- `Project Launcher: Clear Activity`

## Install From VSIX

The packaged VSIX can be installed via `Extensions: Install from VSIX...`.

Marketplace publisher: `daivi16108`

## Recommended Workspace Configuration

```json
{
  "projectLauncher.startTaskLabel": "Dev: start local app",
  "projectLauncher.stopTaskLabel": "Dev: stop local app",
  "projectLauncher.healthTaskLabel": "Dev: healthcheck"
}
```

## Settings

- `projectLauncher.startTaskLabel`: task label executed by Start
- `projectLauncher.stopTaskLabel`: task label executed by Stop when there is no running execution to terminate directly
- `projectLauncher.healthTaskLabel`: optional task label for the Health command/button
- `projectLauncher.showStatusBar`: show or hide all launcher buttons
- `projectLauncher.showHealthButton`: show the Health button when a health task is configured
- `projectLauncher.preventDuplicateStart`: avoid launching the same start task twice
- `projectLauncher.restartDelayMs`: delay between stop and start during restart
- `projectLauncher.activityItemLimit`: maximum number of recent entries in the Activity sidebar view

## Development

To run the extension in an Extension Development Host:

1. Open this repository in VS Code.
2. Press `F5`.

To package a new VSIX:

```powershell
npm run package:vsix
```

## Roadmap

See `ROADMAP.md` for the standalone product plan and the next major feature bets.

## Release Flow

- `.github/workflows/ci.yml` validates `extension.js` and packages a VSIX on pushes and pull requests
- `.github/workflows/release.yml` publishes from a version tag such as `v0.3.0`, uploads the VSIX to the GitHub Release, and publishes to the Marketplace when `VSCE_PAT` is configured
- The same release workflow can be started manually with a `ref` input that points to an existing tag
- `PUBLISHING.md` lists the minimal repository and secret setup required before first publication
