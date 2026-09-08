import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import * as z from "astro/zod";

const tags = z.array(z.string().trim().min(1)).default([]);

const notes = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/notes" }),
  schema: z
    .object({
      title: z.string().min(1),
      description: z.string().min(1),
      pageType: z.enum(["index", "note"]).default("note"),
      indexType: z.enum(["all", "courses", "topics", "tags"]).optional(),
      kind: z.enum(["course", "topic", "reference"]).optional(),
      course: z.string().trim().min(1).optional(),
      topic: z.string().trim().min(1).optional(),
      tags,
      publishedAt: z.coerce.date().optional(),
      updatedAt: z.coerce.date().optional(),
      draft: z.boolean().default(false),
    })
    .refine((note) => note.pageType === "index" || note.draft || note.publishedAt !== undefined, {
      message: "publishedAt is required for a published note",
      path: ["publishedAt"],
    })
    .refine((note) => note.pageType !== "index" || note.indexType !== undefined, {
      message: "indexType is required for a Notes index page",
      path: ["indexType"],
    }),
});

const notesMeta = defineCollection({
  loader: glob({ pattern: "**/*.{json,yaml,yml}", base: "./src/content/notes" }),
  schema: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    pages: z.array(z.string()).optional(),
    icon: z.string().optional(),
  }),
});

const blogSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1),
    attribution: z.boolean().default(true),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    publishedAt: z.coerce.date().optional(),
    updatedAt: z.coerce.date().optional(),
    tags,
    draft: z.boolean().default(false),
  })
  .refine((entry) => entry.draft || entry.publishedAt !== undefined, {
    message: "publishedAt is required for published writing",
    path: ["publishedAt"],
  });

const blog = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog" }),
  schema: blogSchema,
});

const workshopImage = z.object({
  src: z.string(),
  alt: z.string(),
  title: z.string().optional(),
});

const workshops = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/workshops" }),
  schema: z.object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    location: z.string(),
    organizer: z.string(),
    communityGroup: z.string().optional(),
    time: z.string(),
    format: z.string().optional(),
    registration: z.string().optional(),
    topic: z.string().optional(),
    talkTitle: z.string().optional(),
    talkIntro: z.string().optional(),
    links: z
      .array(
        z.object({
          label: z.string(),
          url: z.url(),
        })
      )
      .default([]),
    hero: workshopImage.extend({
      caption: z.string().optional(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
    sections: z
      .array(
        z.object({
          heading: z.string().optional(),
          paragraphs: z.array(z.string()).optional(),
          items: z.array(z.string()).optional(),
        })
      )
      .default([]),
    galleryGroups: z
      .array(
        z.object({
          caption: z.string(),
          images: z.array(workshopImage),
        })
      )
      .default([]),
    additionalInfo: z.string().optional(),
  }),
});

export const collections = {
  notes,
  notesMeta,
  blog,
  workshops,
};
