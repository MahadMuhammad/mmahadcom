# Security policy

Report security issues affecting the deployed website or the current `main` branch. Older revisions are not maintained as separate supported releases.

Send vulnerability reports privately to **mahad@mmahad.com**. Include the affected URL or file, a concise explanation of the impact, and minimal reproduction steps. Redact passwords, tokens, personal information and unrelated account data. Do not include working credentials or publish sensitive details in a public issue or pull request.

Use a local copy to reproduce issues where possible. Do not access other people's accounts or data, disrupt the live website, or perform destructive testing.

The site is statically generated. Draft flags and indexing directives control generated output and discovery; they do not make committed source files or public assets private. Keep credentials in protected deployment secrets, never in content, client code or `public/`.

Once activated, the GitHub Actions production deployment requires the verification checks in `.github/workflows/verify.yml`. See the README for the deployment environment, credential setup, activation status and rollback procedure.

## Temporary build dependency exception

GHSA-ch52-4w7c-c8xp remains unpatched in `http-cache-semantics@4.2.0`, used by Astro's build-time image cache. The reviewed site builds local images and publishes static assets; it does not run Astro as an authenticated response-serving cache. This limits exposure but does not fix the dependency or eliminate every build-time cache risk.

The exception ends at **2026-10-11 00:00 UTC**, with no automatic renewal. CI retains the complete audit findings and permits only this advisory and its exact Astro/MDX dependency chain. Every other finding, malformed audit, failed registry lookup, new upstream release, changed build input or dependency version fails verification. Build inputs, npm install restrictions and the verification/deployment workflow are pinned to the reviewed source; adding content or changing the build requires removing the exception or obtaining a new review and approval. The GitHub publication step checks the deadline again immediately before upload. Astro also checks the same deadline in its final build hook, including direct Astro builds that skip npm lifecycle hooks. Build-completion checks do not attest to the upload time of manual uploads, rollbacks or custom wrappers that ignore a failing build.

Registry signature checks, approved-install-script restrictions and the independent deployment-tool audit remain required. Build checks also reject environment files, server/Worker/Functions output, symlinks, unresolved security headers and cache implementation code in browser bundles. The npm postbuild hook checks the artifact boundary and deadline for ordinary builds, including Cloudflare's npm build path. Remove the exception, Astro integration, deadline guards and source pinning, and restore the ordinary `npm audit` command when a supported fix is available.
