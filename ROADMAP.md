# Project Launcher Roadmap

## Product Goal

Project Launcher should become a practical control center for local development environments, not just a thin task button wrapper.

## Current Baseline

- sidebar control panel with Start, Stop, Restart, Health and setup actions
- activity log and output channel
- quick setup and direct task-binding edits
- status bar controls
- CI and release workflows for standalone publishing

## Phase 1: Zero-Config Experience

Goal: make first-run setup almost invisible.

- detect common project shapes automatically: Django, Vite, Node, Docker Compose, Python venv
- offer one-click workspace onboarding on first open
- suggest recommended start, stop and health tasks without manual label hunting
- highlight missing setup in plain language instead of generic task errors
- add Russian UI strings alongside English for a friendlier local workflow

## Phase 2: Real Runtime Awareness

Goal: move from task state to service state.

- show live service health in the sidebar: frontend, backend, database, docker, custom endpoints
- track the last successful healthcheck timestamp
- add a `Start All` flow with dependency ordering such as `db -> backend -> frontend -> health`
- add `Open Project` actions that launch key URLs after startup
- keep lightweight run history so failures are understandable later

## Phase 3: Workspace Profiles

Goal: make one extension fit many repository shapes.

- support multiple profiles like `local`, `docker`, `backend only`, `frontend only`, `full stack`
- switch profiles from the sidebar with one click
- allow profile-specific tasks, ports, health endpoints and URLs
- export and import profiles so similar projects can be configured quickly

## Phase 4: Doctor Mode

Goal: help users recover instead of only reporting failure.

- detect common local environment problems: missing `.venv`, missing `node_modules`, blocked ports, stopped Docker daemon, missing env files
- explain failures in a short human-readable diagnosis
- add a guided `Fix My Dev Environment` action for safe repair steps
- surface the most relevant logs automatically when a launch fails

## Bold Bets

These are the highest-upside ideas once the baseline becomes stable.

### Task Graph UI

- render services and dependencies visually instead of as a plain list
- show which node is starting, healthy, degraded or failed

### Multi-Project Dashboard

- monitor several related repositories from one sidebar
- show ports, health and active profile per project

### AI-Assisted Diagnostics

- summarize likely reasons for a failed launch from task output and recent activity
- propose the next command or log file to inspect

### Dev Session Snapshots

- save and restore previous local development sessions
- remember which profile, terminals and services were active

## Suggested Delivery Order

1. zero-config onboarding
2. live service health
3. workspace profiles
4. doctor mode
5. task graph and AI diagnostics