import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
const news = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/news' }),
  schema: z.object({
    title: z.string().min(10).max(120),
    description: z.string().min(30).max(200),
    excerpt: z.string().optional(),
    publishDate: z.coerce.date(),
    updateDate: z.coerce.date().optional(),
    author: z.object({ name: z.string(), avatar: z.string().optional(), role: z.string().optional() }).default({ name: 'n0ai Newsdesk' }),
    category: z.string(),
    tags: z.array(z.string()).default([]),
    cover: z.object({ src: z.string(), alt: z.string(), width: z.number().optional(), height: z.number().optional() }),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    readingTime: z.number().optional(),
    breaking: z.boolean().default(false),
    location: z.string().optional(),
    sources: z.array(z.object({ title: z.string(), url: z.string().url(), publisher: z.string().optional() })).optional(),
    faq: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
  })
});
export const collections = { news };
