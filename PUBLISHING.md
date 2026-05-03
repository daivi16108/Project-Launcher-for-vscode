# Publishing

This repository is already structured as the standalone root for the extension.

## Minimum Setup

1. Create or confirm the VS Code Marketplace publisher `daivi16108`.
2. Keep `publisher` in `package.json` aligned with that Marketplace publisher.
3. Create a VS Code Marketplace personal access token and store it as the `VSCE_PAT` repository secret.
4. Push a semantic version tag such as `v0.3.0`.

## Included Automation

- `.github/workflows/ci.yml` checks `extension.js` syntax and builds a VSIX artifact.
- `.github/workflows/release.yml` verifies the selected tag matches `package.json`, packages the extension, uploads the VSIX to GitHub Releases, and publishes to the Marketplace when `VSCE_PAT` is present.
- Manual workflow runs are supported, but they must target an existing version tag through the `ref` input.

## Recommended First Release Checklist

1. Confirm the `version` field in `package.json` matches the first public tag. The current candidate is `v0.3.0`.
2. Confirm `README.md`, `CHANGELOG.md`, icon, and license are final.
3. Run `npm run lint` and `npm run package:vsix` locally once before tagging.
4. Push the tag with `git tag v0.3.0` and `git push origin v0.3.0`.

## Product Planning

The current product and feature roadmap lives in `ROADMAP.md`.
