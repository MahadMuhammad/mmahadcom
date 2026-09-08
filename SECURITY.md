# Security policy

Report security issues affecting the deployed website or the current `main` branch. Older revisions are not maintained as separate supported releases.

Send vulnerability reports privately to **mahad@mmahad.com**. Include the affected URL or file, a concise explanation of the impact, and minimal reproduction steps. Redact passwords, tokens, personal information and unrelated account data. Do not include working credentials or publish sensitive details in a public issue or pull request.

Use a local copy to reproduce issues where possible. Do not access other people's accounts or data, disrupt the live website, or perform destructive testing.

The site is statically generated. Draft flags and indexing directives control generated output and discovery; they do not make committed source files or public assets private. Keep credentials in protected deployment secrets, never in content, client code or `public/`.

Once activated, the GitHub Actions production deployment requires the verification checks in `.github/workflows/verify.yml`. See the README for the deployment environment, credential setup, activation status and rollback procedure.
