# mmahad.com

Source for [mmahad.com](https://www.mmahad.com): Muhammad Mahad's personal website, built as a static Astro portfolio with a standalone Blog using Fumadocs reading components and a separate Fumadocs Notes section. The canonical repository is [MahadMuhammad/mmahadcom](https://github.com/MahadMuhammad/mmahadcom).

## Architecture

- **Astro** owns the static portfolio, workshop, blog, and metadata routes.
- **Fumadocs UI** supplies individual Blog reading tools and the separate Notes documentation layout. Blog does not use `DocsLayout` or the Notes page tree. Notes also includes search and Markdown access.
- **Astro content collections** validate workshops, blog posts and Notes during the build.
- **Cloudflare Pages** builds the repository and serves the generated `dist/` directory.

## Local development

Use Node.js 22 or 24 and the npm version declared in `package.json`. Node.js 22 is the primary local and browser-test runtime.

```sh
npm ci
npm run dev
```

Run the complete local verification gate with:

```sh
npm run format:check
npm run verify
npm run check:a11y
npm run check:blog
npm audit
```

`npm run verify` runs Astro type checking, Notes anchor validation, a production build, generated-metadata assertions, LLM-output checks, and internal-link validation. `npm run check:a11y` checks every generated page at desktop and 320px widths, enforces the generated Content Security Policy, checks mobile horizontal overflow, and audits the opened Notes search and workshop lightbox states.

### Automatic content and source links

Astro generates the LLM indexes, full-text exports, Markdown endpoints, sitemap and Notes search from the published content on every build. The npm `postbuild` hook applies the generated CSP and validates metadata, LLM coverage and internal links automatically, including when running only `npm run build`. A missing route or export fails the build. CI uses the same hook through `npm run verify`; the prepared GitHub Actions deployment waits for both verification jobs when enabled. Use the npm scripts rather than invoking `astro build` directly if you need these checks.

Notes offers GitHub under **Open with**. Published Blog posts and event pages link to their exact content file; the portfolio footer links to the repository. These links use `src/data/source-repository.json` as the single repository URL, branch and visibility setting. Local development previews the links while the repository is private; production hides them. A local file that has not been pushed may not exist on GitHub yet.

After the repository and intended content are actually public on the configured branch, set `public` to `true` in that JSON file and rebuild. This enables the links and updates the generated-output privacy check together. It does not change GitHub visibility, grant a license, or publish drafts. Draft previews do not gain public source/share controls.

### Focused browser verification

Install the test browser once with `npx playwright install chromium`. The runner also supports an installed Chrome on macOS when bundled Chromium is unavailable.

After `npm run build`, check only the pages you changed:

```sh
npm run check:a11y -- --routes /,/blog/,/notes/ --screenshots
npm run check:a11y -- --routes /,/blog/,/notes/ --theme light --screenshots
```

Use exact built paths with trailing slashes. An unknown route fails instead of silently skipping verification. The default theme is dark; `--theme light` also applies to interaction checks. Without `--routes`, all built pages and interaction checks run. With it, Notes interactions run when `/notes/` is selected, and gallery interactions run when `/volunteering/hacktoberfest-lahore-2025/` is selected.

Page audits save screenshots on accessibility, CSP, overflow, or page-load failures. `--screenshots` also saves successful page and opened-state captures under ignored `test-results/a11y/<theme>/`. These are inspection artifacts, not pixel-diff assertions. Repeated runs overwrite matching filenames. A passing empty writing index does not verify an article's content; inspect its generated route when publishing.

`npm run check:blog` builds two synthetic articles from `scripts/fixtures/blog/` in a temporary project and exercises their shared reader, archive filters, screenshot dialogs, references, exports, and optional tags. One article contains two independent comparisons; the other has no tags or contents. The source drafts and production `dist/` remain untouched, and the temporary build is deleted after success or failure. Dependencies are copied with copy-on-write where supported instead of symlinked, so Astro resolves everything inside the temporary root. Failure screenshots are retained under ignored `test-results/blog-fixtures/`. Use `-- --theme light` or `-- --screenshots` for a focused visual pass. CI checks both light and dark themes even when all real posts remain drafts.

### Preview the correct worktree

Check `git rev-parse --show-toplevel` before starting a server. Preview the build directly from that checkout:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4322
```

Use the URL printed by Astro. Give simultaneous worktrees different ports. Rebuild after changes, then reload the browser. Avoid copying `dist/` to a separate preview directory: the extra copy can show stale code or retain deleted routes. `astro preview` does not reproduce Cloudflare's `_headers`; the browser verification runner serves the generated CSP for that check.

### Dependency and credential security

CI installs the lockfile with `npm ci --ignore-scripts`, runs the full `npm audit` and `npm audit signatures`, then runs `npm rebuild` before the site checks. This checks known vulnerabilities, registry signatures and available provenance before dependency lifecycle scripts execute. `.npmrc` enables `strict-allow-scripts`, and `package.json` approves exact package versions through `allowScripts`; a dependency with an unreviewed install script fails the rebuild. Review the package and its script before changing that policy. Registry signatures verify package authenticity, not whether its code is safe. See [npm's audit documentation](https://docs.npmjs.com/cli/v11/commands/npm-audit).

The full audit includes development tools because CI executes them. Gitleaks separately scans committed history for credentials with redacted output; `npm audit` does not search the website's source for secrets. Pull request and build jobs receive no Cloudflare or npm credentials, checkout does not retain its token, and the GitHub token has read-only permissions. Keep secrets out of source, build output, logs and cached paths. The deployment job receives its protected environment credential only for the final upload step after its own tool checks.

Dependabot checks npm dependencies and pinned GitHub Actions weekly, opening at most three routine update PRs per ecosystem. Routine updates wait seven days after release; security updates are not subject to that cooldown. Keep Dependabot alerts and security updates enabled in the repository settings. Review updates and require CI before merging; this repository does not automatically merge them. Install-script approvals still require separate review when an approved package version changes.

When making the repository public, enable repository secret scanning and push protection to block supported credential patterns before they reach GitHub. Gitleaks in CI runs after a push and cannot undo a secret already exposed in Git history. If a credential is exposed, revoke or rotate it before cleaning up copies. GitHub documents [push protection](https://docs.github.com/en/code-security/concepts/secret-security/push-protection) and [Dependabot's update controls](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference).

## Content

- Portfolio data: `src/data/site.ts`
- Workshops: `src/content/workshops/`
- Blog posts: `src/content/blog/`
- Notes: `src/content/notes/`
- Public media: `public/`

Blog publishing rules live in `src/lib/blog-source.ts`. Longer essays are Blog posts too. Blog presentation lives in `BlogLayout.astro`, `src/components/blog/`, and `src/styles/blog.css`. Notes retain their own Fumadocs shell. Blog code-copy controls and interactive MDX examples use explicit React islands; rendering a React component to static MDX HTML alone does not activate its controls. `src/lib/home-writing.ts` selects the three latest published pieces for `HomeWriting.astro`; drafts and Notes index pages are excluded, and the homepage section is absent when empty. Shared visual tokens live in `src/styles/tokens.css`; page-specific layout belongs in the relevant page stylesheet or component.

Workshop frontmatter is validated by `src/content.config.ts`. To prepare high-resolution event photography, run:

```sh
npm run images:workshop -- /path/to/source-images public/workshops/event-slug
```

The optimizer creates responsive image variants without modifying the source photographs.

## Deployment

Cloudflare Pages serves the production site at `https://www.mmahad.com`. The existing Pages project uses native Git integration with `main` as production and preview deployments for other branches. That connection builds committed GitHub source without using a local Wrangler/API token. Confirm the live project settings before changing that integration.

`.github/workflows/verify.yml` prepares automatic deployment through GitHub Actions. Deployment stays disabled until the repository variable `CLOUDFLARE_DEPLOY_ENABLED` is exactly `true`; adding the workflow alone does not configure Cloudflare or publish the site.

Once enabled, a push to `main` or a manual run on `main` must pass the existing Node.js 22 and 24 verification jobs. A separate runner downloads that run's tested Node.js 22 `dist/` artifact, checks that it contains static assets, and uploads it without rebuilding or checking out application code. Pull requests cannot enter this deployment job. Main runs are serialized without cancellation, and the uploader rejects a commit that no longer matches `main`. Other refs retain verification cancellation.

Before activation:

1. Confirm the existing Pages project, owning account, and production branch through the Cloudflare dashboard or API. Record the last successful production deployment as a rollback target. Keep the existing project and custom domains.
2. Create a new dedicated API token with **Account / Cloudflare Pages / Edit**, limited to the owning account. This permission covers Pages in that account; it is not a project-specific token. Do not reuse expired credentials or a global API key.
3. Configure a GitHub environment named `production` restricted to the **branch** `main`, with no permitted tag rule. Add the token as its secret `CLOUDFLARE_API_TOKEN`, and the confirmed identifiers as environment variables `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_PROJECT_NAME`. Private repositories require a GitHub plan supporting environments and deployment branch restrictions. Keep deployment disabled if this boundary cannot be configured.
4. Set the repository's default workflow token permissions to read. Protect `main` with the existing Node.js 22 and 24 verification checks, and block force pushes and deletion. Inspect any legacy GitHub Pages workflow or deployment before activation so it cannot publish independently.
5. Publish the intended changes with deployment still disabled and confirm the exact `main` commit passes verification and produces the expected artifact. At a controlled switchover, disable native Cloudflare Git automatic production and preview builds if enabled, retaining the known-good deployment as fallback. Then set the **repository** variable `CLOUDFLARE_DEPLOY_ENABLED=true` and manually run the workflow on `main`.
6. Confirm both GitHub jobs and the Cloudflare production deployment succeed for that exact commit. Check the custom domain, deployment URL, important routes, generated CSP, content types, and caching before considering the switchover complete.

The deployment runner uses pinned npm `11.16.0`, installs pinned Wrangler `4.129.0` with lifecycle scripts disabled, and checks vulnerabilities, registry signatures and available provenance before executing Wrangler or receiving the Cloudflare token. Its transitive dependencies resolve at installation time. Third-party Actions are pinned by full commit SHA. Downloaded artifact digest mismatches fail deployment; unexpected Workers, Functions, configuration, symlinks, and hidden output are rejected, while public `.well-known` assets are preserved.

For a retry, start a fresh manual run on `main` or rerun **all jobs** so the artifact is recreated for that attempt. For a normal rollback, revert the change and let the pipeline verify and publish the revert. For an emergency rollback, first disable the deployment variable and stop pending publishing runs, then restore a previous successful production deployment in Cloudflare and verify it. Old workflow runs cannot bypass the current-main check.

## License and security

The original website code and developer documentation are licensed under [Apache 2.0](LICENSE), with project attribution in [`NOTICE`](NOTICE). You may adapt the implementation for your own site. Personal writing, biography, photographs and other media have separate terms; replace them with your own material when reusing the code. See [`COPYRIGHT.md`](COPYRIGHT.md) for the scope and content policy.

Third-party assets retain their original licenses; see [`public/THIRD_PARTY_NOTICES.txt`](public/THIRD_PARTY_NOTICES.txt).

Report vulnerabilities privately using [`SECURITY.md`](SECURITY.md).

### Saving and sharing posts

Every published Blog post has a `.md` endpoint (for example, `/blog/my-post.md`). `blog-export.ts` supplies both the article controls and the endpoint from one build-time export. Readers can copy Markdown, download the file, copy the canonical link, or use their device's share sheet. Unsupported sharing falls back to copying the link; clipboard failures offer a download or selectable URL.

`blog-markdown.mjs` parses MDX instead of stripping it with regular expressions: code, tables, lists, and links remain Markdown; imports are omitted; interactive components link back to the article. Keep essential explanations in ordinary Markdown next to interactive examples. Computed prose expressions fail export so they cannot silently disappear. All export links resolve against the article's canonical URL.

Exports end with a small author/source credit. Set `attribution: false` in a post's frontmatter to omit that credit. This is attribution, not a content license or copy restriction. Drafts generate neither article pages nor Markdown endpoints. `/essays/` now redirects to `/blog/`; use Notes for step-by-step explanations and reference material.

Blog tags come from each post's `tags` frontmatter. The Blog index derives topic counts from published posts, filters one topic at a time, and places topic filters below the post list. It stores the selection in `?tag=` so links can be shared and browser Back restores the previous filter. Topic matching ignores case and surrounding whitespace. With JavaScript disabled, the index still shows all published posts.

The portfolio and Blog share `SiteHeader.astro`, `site-header.css`, and the same theme initializer. Header controls use custom elements so they reconnect correctly after Astro client navigation. Article reading preferences offer explicit Standard/Larger text sizes and an optional serif body font; topic links sit at the end of the article.

### Reusing the Blog reading template

Start from `src/content/blog/_draft-template.mdx`. The title and description form the article header; H2/H3 headings generate its contents. `BlogContents.tsx` owns the desktop contents rail, sticky mobile disclosure, and article-position indicator. Position measures the article body, reaches 100% when its final lines are visible, and recalculates when text size or embedded content changes. It is a location cue, not a claim that someone has read the text. Scroll work is scheduled once per animation frame and listeners are removed on navigation.

Use native Markdown footnotes for citations or short asides. On wide screens, `BlogReference.tsx` displays the nearby citation beneath the contents panel. Clicking a citation focuses this reference without jumping away from the paragraph; Escape or Close returns focus. The contents and reference share a bounded, scrollable rail so they cannot overlap. Narrow screens and JavaScript-free pages retain native endnotes, return links, and the destination highlight. Markdown exports preserve the original footnotes. Use an MDX `<figure>` containing a Markdown image and `<figcaption>` for meaningful illustrations; both image and caption survive Markdown export. Do not place essential text in image-only captions or JSX props. Optional authoring patterns are shown below. Copy only the patterns your article needs.

Keep enhancements subordinate to reading: existing color and type tokens, no scroll hijacking, no automatic content reveals, and reduced-motion support. The contents disclosure stays below the site header on narrow screens, closes after a section jump or Escape, and uses ordinary anchor links. A short post without headings does not need a contents rail. New posts inherit these features without copying layout code.

Copy the draft template to a descriptive filename, replace all starter text, and keep `draft: true` during review. Add `publishedAt: YYYY-MM-DD` and change `draft` only when the post is ready to publish. The template headings are suggestions; use the structure the actual story needs.

### Previewing your own draft

Run `npm run dev` and open `/drafts/blog/your-post-slug/` at the local URL Astro prints. The slug comes from frontmatter when provided, otherwise from the filename. Files or folders beginning with `_` are authoring templates and have no preview route.

The draft uses the same reading layout and MDX components as a published post, with a visible “Draft preview · Not published” notice. It has no publication date or public share/export controls. You can edit the Markdown or MDX source and see changes without changing `draft: true` or inventing a publication date.

Draft preview routes exist only in the development server. `npm run build` emits none of them, and drafts stay out of the public archive, homepage Writing section, sitemap, and Markdown exports. Draft pages also carry `noindex, nofollow`; this is a development convenience, not access control. Run the development server locally rather than exposing it publicly. Source files and anything under `public/` still become visible if you publish the repository or deploy those assets.

A source note uses standard Markdown and keeps a return link:

```md
A claim with supporting evidence.[^source]

[^source]: [Descriptive source title](https://example.com/source).
```

A figure uses an actual local image with meaningful alternative text and a factual caption:

```mdx
<figure>

![Describe the relevant detail](/images/your-image.webp)

<figcaption>What the image demonstrates. Credit its creator if applicable.</figcaption>
</figure>
```

Use `>` blockquotes for attributed quotations. Do not repeat paragraphs as decorative pull quotes or add images solely to fill space. Keep essential explanation in ordinary Markdown alongside any interactive component.

### Blog interaction and motion rules

Every article inherits these rules from the shared Blog components; authors do not copy UI code into MDX. Progress remains beside the contents in the right rail on desktop and beneath the sticky contents disclosure on narrow screens; it measures only the article body.

- Copy actions keep stable labels and use Lucide icons from `react-icons/lu`. Copy icons and labels stay mounted in `BlogActionFeedback.tsx`, reserving their maximum width. A successful copy crossfades to `LuCheck`; the live acknowledgement and icon reset after four seconds. A pending or failed action never displays the checkmark.
- Text size uses native Standard/Larger radio choices with arrow-key navigation. The optional Serif text toggle keeps a stable label and announces its pressed state. Both choices persist across visits when browser storage is available; the controls still work when storage is blocked.
- Motion supports a specific action: 160ms color changes for reading choices, and 200ms opacity/scale transitions for copy confirmation and reset. Existing title entrance and contents-disclosure animations remain brief. `prefers-reduced-motion` disables these transitions.
- No randomized decoration, looping background animation, or hidden-until-scrolled paragraphs. Explanatory animation belongs in a specific interactive example, with controls and a readable static explanation.

### Before-and-after figures

`BlogImageComparison.astro` accepts a `label`, optional `beforeLabel` / `afterLabel`, and two named figure slots (`before` and `after`). Put ordinary Markdown image links and factual captions inside the slots, as shown in `scripts/fixtures/blog/reader.mdx`. Both views remain in Markdown exports and print output. Without JavaScript, both figures are visible; with JavaScript, native buttons crossfade between them without changing the figure's height. Image and full-size caption links open a native screenshot dialog, keeping readers in the article. Fit shows the whole image; Actual size exposes its original detail in a scrollable area. Escape, the close button, or the backdrop dismiss it and restore focus. Without JavaScript, the links still open the image files. Keep each pair at matching dimensions. The image area uses its intrinsic aspect ratio once loaded, with a landscape placeholder during loading.
