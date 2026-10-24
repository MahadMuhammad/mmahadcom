# Security policy

Report security issues affecting the deployed website or the current `main` branch. Older revisions are not maintained as separate supported releases.

Send vulnerability reports privately to **mahad@mmahad.com**. Include the affected URL or file, a concise explanation of the impact, and minimal reproduction steps. Redact passwords, tokens, personal information and unrelated account data. Do not include working credentials or publish sensitive details in a public issue or pull request.

Use a local copy to reproduce issues where possible. Do not access other people's accounts or data, disrupt the live website, or perform destructive testing.

The site is statically generated. Draft flags and indexing directives control generated output and discovery; they do not make committed source files or public assets private. Keep credentials in protected deployment secrets, never in content, client code or `public/`.

Once activated, the GitHub Actions production deployment requires the verification checks in `.github/workflows/verify.yml`. See the README for the deployment environment, credential setup, activation status and rollback procedure.

## Build dependency security

Dependency installation and builds must pass the complete npm advisory audit without exceptions. CI also verifies registry signatures and attestations before running approved dependency install scripts. The previously time-limited dependency exception has been retired.

The upstream `http-cache-semantics@4.3.0` release can still revive entries whose freshness lifetime was zeroed for security reasons through a client `max-stale` request. A clean registry audit alone does not establish that this behavior was fixed. The build applies a small, pinned mitigation in [scripts/harden-cache.mjs](scripts/harden-cache.mjs): entries that are not storable or have a zero maximum age always require synchronous revalidation and never return a cached response. Ordinary fresh public responses and explicitly permitted stale public responses with positive lifetimes retain their behavior.

The mitigation accepts only the exact reviewed upstream source or its exact hardened hash, checks every locked copy, and rejects version changes, modified source, missing guards, and symlinked packages. It runs after installation and the clean dependency audit. Astro verifies the hardened source before configuration and at build completion, including direct builds that bypass npm lifecycle scripts. Regression tests reproduce the upstream cookie-response issue and cover private, no-store, no-cache, authenticated, cookie-bearing, and revalidation-only responses, serialized policies, and valid public-cache behavior.

This is a repository-maintained mitigation, not a claim that the upstream advisory has been withdrawn. Review the guard and regression cases when updating the cache dependency, and remove the patch only after the replacement passes those cases. See [GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp).

The deployed site remains static. Artifact checks reject environment files, server/Worker/Functions output, symlinks, unresolved security headers, and cache implementation code in browser bundles. Merge production changes only after the pull request verification and signature checks pass. Cloudflare's Git integration builds the same lockfile and runs the prebuild advisory audit and postbuild artifact checks. When enabled, the separate GitHub publication job also audits its deployment tool and checks that the verified commit is still the current production branch head.
