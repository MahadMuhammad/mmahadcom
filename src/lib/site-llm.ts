import { getCollection } from "astro:content";
import {
  about,
  communityLeadership,
  contactProfiles,
  education,
  legacyWorkshops,
  openSourceProjects,
  pageDescriptions,
  site,
  teachingExperiences,
} from "../data/site";
import { getWritingPath, getPublishedBlog } from "./blog-source";
import { getBlogExport } from "./blog-export";
import { getNoteMarkdownPath, getNotesIndexPages, getNotesLLMsFullText, getPublishedNotes } from "./notes-llm";

const portfolioPages = [
  { label: "About", path: "/", description: pageDescriptions.about },
  { label: "Open source", path: "/open-source/", description: pageDescriptions.openSource },
  { label: "Teaching", path: "/teaching/", description: pageDescriptions.teaching },
  { label: "Volunteering", path: "/volunteering/", description: pageDescriptions.volunteering },
  { label: "Education", path: "/education/", description: pageDescriptions.education },
  { label: "Blog", path: "/blog/", description: "Tutorials, experiments, personal updates, and observations." },
  { label: "Contact", path: "/contact/", description: pageDescriptions.contact },
] as const;

function absoluteUrl(path: string): string {
  return new URL(path, site.url).toString();
}

function link(label: string, href: string, description: string): string {
  return `- [${label}](${href}): ${description}`;
}

export async function getSiteLLMsIndex(): Promise<string> {
  const [posts, workshopEntries] = await Promise.all([getPublishedBlog(), getCollection("workshops")]);
  const notesIndexes = getNotesIndexPages();
  const publishedNotes = getPublishedNotes();
  const lines = [
    `# ${site.fullName}`,
    "",
    `> ${site.description}`,
    "",
    `${site.fullName}'s personal website covers his open-source work, teaching, community volunteering, education, writing, and ${
      publishedNotes.length > 0 ? "published notes" : "Notes indexes prepared for future publications"
    }.`,
    "",
    `Canonical site: ${site.url}/`,
    "",
    "## Portfolio",
    "",
    ...portfolioPages.map((page) =>
      link(page.label, absoluteUrl(page.path), page.path === "/blog/" && posts.length === 0 ? "No blog posts are published yet." : page.description)
    ),
    "",
    "## Selected open-source work",
    "",
    ...openSourceProjects.map((project) => link(project.title, project.href, `${project.date} with ${project.organization}. ${project.description}`)),
    "",
    "## Community event pages",
    "",
    ...workshopEntries
      .toSorted((left, right) => right.data.date.valueOf() - left.data.date.valueOf())
      .map((workshop) => link(workshop.data.title, absoluteUrl(`/volunteering/${workshop.data.slug}/`), workshop.data.description)),
  ];

  lines.push("", posts.length ? "## Published blog posts" : "## Blog", "");
  if (posts.length === 0) lines.push("No blog posts are published yet.");
  else lines.push(...posts.map((post) => link(post.data.title, absoluteUrl(getWritingPath(post)), post.data.description)));

  lines.push(
    "",
    "## Notes",
    "",
    link("Notes website", absoluteUrl("/notes/"), "The human-readable Notes area and its topic, course, and tag indexes."),
    "",
    "### Notes indexes",
    "",
    ...notesIndexes.map((page) => link(page.data.title, absoluteUrl(getNoteMarkdownPath(page.url)), page.data.description)),
    ...(publishedNotes.length === 0
      ? ["", "No notes are published yet. The links above are index pages prepared for future notes."]
      : [
          "",
          "### Published notes",
          "",
          ...publishedNotes.map((page) => link(page.data.title, absoluteUrl(getNoteMarkdownPath(page.url)), page.data.description)),
        ]),
    "",
    "## Contact",
    "",
    ...contactProfiles.map((profile) => link(profile.title, profile.href, profile.value)),
    "",
    "## Machine-readable resources",
    "",
    link(
      "Extended site context",
      absoluteUrl("/llms-full.txt"),
      "Portfolio details, workshop accounts, published Blog posts, and Notes in one text file."
    ),
    link("Notes-only LLM index", absoluteUrl("/notes/llms.txt"), "A scoped index generated from the Fumadocs Notes collection."),
    link(
      "Notes content export",
      absoluteUrl("/notes/llms-full.txt"),
      "Available note content with an explicit empty state when no notes are published."
    ),
    link("Sitemap", absoluteUrl("/sitemap.xml"), "All indexable website routes."),
    ""
  );

  return lines.join("\n");
}

export async function getSiteLLMsFullText(): Promise<string> {
  const [index, workshopEntries, posts] = await Promise.all([getSiteLLMsIndex(), getCollection("workshops"), getPublishedBlog()]);
  const publishedNotes = getPublishedNotes();
  const lines = [
    index,
    "---",
    "",
    "## Extended profile",
    "",
    ...about.profileFacts.map((fact) => `- ${fact}`),
    "",
    "## Open-source projects",
    "",
    ...openSourceProjects.flatMap((project) => [
      `### ${project.title}`,
      "",
      `${project.date} | ${project.organization}`,
      "",
      project.description,
      "",
      project.impact,
      "",
    ]),
    "## Teaching",
    "",
    ...teachingExperiences.flatMap((experience) => [
      `### ${experience.title}`,
      "",
      experience.meta,
      "",
      ...experience.paragraphs.flatMap((paragraph) => [paragraph, ""]),
    ]),
    "## Community leadership",
    "",
    ...communityLeadership.flatMap((initiative) => [
      `### ${initiative.title}`,
      "",
      `${initiative.role} | ${initiative.date}`,
      "",
      initiative.description,
      "",
    ]),
    "## Workshops and events",
    "",
    ...workshopEntries
      .toSorted((left, right) => right.data.date.valueOf() - left.data.date.valueOf())
      .flatMap((workshop) => [
        `### ${workshop.data.title}`,
        "",
        `${workshop.data.date.toISOString().slice(0, 10)} | ${workshop.data.location} | ${workshop.data.organizer}`,
        "",
        workshop.data.description,
        "",
        `Canonical: ${absoluteUrl(`/volunteering/${workshop.data.slug}/`)}`,
        "",
        ...workshop.data.sections.flatMap((section) => [
          ...(section.heading ? [`#### ${section.heading}`, ""] : []),
          ...(section.heading === "My Talk" && workshop.data.talkIntro && workshop.data.talkTitle
            ? [
                `${workshop.data.talkIntro} “${workshop.data.talkTitle}”, ${section.paragraphs?.[0] ?? ""}`,
                "",
                ...(section.paragraphs?.slice(1) ?? []).flatMap((paragraph) => [paragraph, ""]),
              ]
            : (section.paragraphs ?? []).flatMap((paragraph) => [paragraph, ""])),
          ...(section.items ?? []).map((item) => `- ${item}`),
          "",
        ]),
        `Time: ${workshop.data.time}`,
        ...(workshop.data.communityGroup ? [`Community group: ${workshop.data.communityGroup}`] : []),
        ...(workshop.data.format ? [`Format: ${workshop.data.format}`] : []),
        ...(workshop.data.registration ? [`Registration: ${workshop.data.registration}`] : []),
        "",
        ...workshop.data.links.map((resource) => `- [${resource.label}](${resource.url})`),
        "",
        ...(workshop.data.additionalInfo ? [workshop.data.additionalInfo, ""] : []),
      ]),
    ...legacyWorkshops.flatMap((workshop) => [`### ${workshop.title}`, "", workshop.meta, "", workshop.description, ""]),
    "## Education",
    "",
    `- ${education.degree.title}, ${education.degree.institution} (${education.degree.date})`,
    ...education.certificates.map((certificate) => `- ${certificate.title} — ${certificate.provider}`),
    "",
    ...(posts.length ? ["## Published blog posts", "", ...posts.map((post) => getBlogExport(post).markdownContent.trim()), ""] : []),
    ...(publishedNotes.length === 0
      ? ["## Notes content", "", "No notes are published yet."]
      : [
          "## Published notes",
          "",
          getNotesLLMsFullText()
            .replace(/^# Notes\n+/, "")
            .trim(),
        ]),
  ];

  return `${lines.join("\n").trim()}\n`;
}
