# Publishing Guide

This document covers the minimal setup required before publishing the **Project Launcher** extension for the first time.

---

## Repository Setup

1. **Create a new GitHub repository** (if extracting from a monorepo):
   - Repository name: `vscode-project-launcher` (or your preferred name)
   - Visibility: Public (required for the VS Code Marketplace free tier)
   - Copy the contents of `tools/vscode-project-launcher/` to the root of the new repo
   - Copy `.github/workflows/` to the new repo

2. **Set the correct publisher** in `package.json`:
   ```json
   "publisher": "your-publisher-id"
   ```
   The publisher ID must match the publisher you create on the VS Code Marketplace.

---

## VS Code Marketplace Setup

1. Go to <https://marketplace.visualstudio.com/manage> and sign in with a Microsoft account.
2. Click **Create publisher** and fill in the form.
3. Note your **Publisher ID** — set it in `package.json`.

---

## Personal Access Token (PAT)

The release workflow uses `GITHUB_TOKEN` (automatically provided by GitHub Actions) to upload the VSIX to a GitHub Release.

To **publish directly to the VS Code Marketplace** (optional), you need an Azure DevOps PAT:

1. Go to <https://dev.azure.com> → **User settings** → **Personal access tokens**.
2. Create a new token with **Marketplace → Manage** scope.
3. Add it as a repository secret named `VSCE_PAT` in **Settings → Secrets and variables → Actions**.
4. Add the following step to `release.yml` (after packaging):

   ```yaml
   - name: Publish to VS Code Marketplace
     run: npx @vscode/vsce publish --pat ${{ secrets.VSCE_PAT }}
   ```

---

## First Release

1. Ensure `package.json` has the correct `version`, `publisher`, `name`, and `displayName`.
2. Push a version tag to trigger the release workflow:

   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

3. The workflow will:
   - Validate `extension.js`
   - Package a `.vsix` file
   - Attach it to the GitHub Release created for the tag

4. Download the `.vsix` from the GitHub Release and install it locally via:
   **Extensions → Install from VSIX…**

---

## Required Secrets Summary

| Secret | Required | Purpose |
|--------|----------|---------|
| `GITHUB_TOKEN` | Automatic | Upload VSIX to GitHub Release |
| `VSCE_PAT` | Optional | Publish to VS Code Marketplace |

---

## Checklist Before First Publish

- [ ] `package.json` `publisher` field set to your Marketplace publisher ID
- [ ] `package.json` `version` is correct (e.g. `0.1.0`)
- [ ] `package.json` `repository` field points to your GitHub repo URL
- [ ] Extension tested locally with `F5` in the Extension Development Host
- [ ] `.vsix` packaged and installed via **Install from VSIX** and smoke-tested
- [ ] `VSCE_PAT` secret added (if publishing to Marketplace)
