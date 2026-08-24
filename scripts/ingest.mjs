#!/usr/bin/env node
/**
 * n0ai â€” Daily auto ingest
 * - Fetch RSS tá»« nguá»“n uy tÃ­n háº±ng ngÃ y
 * - Rewrite thÃ nh bÃ i hoÃ n chá»‰nh chuáº©n SEO/SDO/GEO/AEO
 * - Ghi ra markdown vÃ o src/content/blog|news
 * 
 * Cháº¡y: node scripts/ingest.mjs
 * Cron: 0 6,18 * * * (06:00 & 18:00 ICT)
 * 
 * AI: Æ°u tiÃªn thueapi.luuvan.site / subapi.luuvan.site (OpenAI-compatible)
 * Fallback: template rewrite náº¿u khÃ´ng cÃ³ API key
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';

const ROOT = path.resolve(import.meta.dirname, '..');
const BLOG_DIR = path.join(ROOT, 'src/content/blog');
const NEWS_DIR = path.join(ROOT, 'src/content/news');

// --- Cáº¥u hÃ¬nh nguá»“n â€” theo tin HOT háº±ng ngÃ y ---
const SOURCES = {
  news: [
    { url: 'https://vnexpress.net/rss/tin-moi-nhat.rss', category: 'Äá»i sá»‘ng', publisher: 'VnExpress', lang: 'vi' },
    { url: 'https://vnexpress.net/rss/tin-nong.rss', category: 'Äá»i sá»‘ng', publisher: 'VnExpress', lang: 'vi' },
    { url: 'https://vnexpress.net/rss/kinh-doanh.rss', category: 'Kinh táº¿', publisher: 'VnExpress', lang: 'vi' },
    { url: 'https://vnexpress.net/rss/khoa-hoc.rss', category: 'CÃ´ng nghá»‡', publisher: 'VnExpress', lang: 'vi' },
    { url: 'https://vnexpress.net/rss/the-gioi.rss', category: 'Äá»i sá»‘ng', publisher: 'VnExpress', lang: 'vi' },
    { url: 'https://cafebiz.vn/rss/home.rss', category: 'Kinh táº¿', publisher: 'CafeBiz', lang: 'vi' },
    { url: 'https://tuoitre.vn/rss/tin-moi-nhat.rss', category: 'Äá»i sá»‘ng', publisher: 'Tuá»•i Tráº»', lang: 'vi' },
    { url: 'https://thanhnien.vn/rss/home.rss', category: 'Äá»i sá»‘ng', publisher: 'Thanh NiÃªn', lang: 'vi' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', category: 'CÃ´ng nghá»‡', publisher: 'NYTimes', lang: 'en' },
    { url: 'https://www.theverge.com/rss/index.xml', category: 'CÃ´ng nghá»‡', publisher: 'The Verge', lang: 'en' },
  ],
  blog: [
    { url: 'https://openai.com/blog/rss.xml', category: 'AI', publisher: 'OpenAI', lang: 'en' },
    { url: 'https://blog.google/rss/', category: 'AI', publisher: 'Google Blog', lang: 'en' },
  ]
};

// --- Helpers ---
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function slugify(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
function cleanText(s = '') {
  return s.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1').replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim().slice(0, 500);
}
function pickImage(item, category) {
  // Map category -> unsplash fallback (Ä‘áº£m báº£o luÃ´n cÃ³ áº£nh Ä‘áº¹p, CLS 0)
  const map = {
    'CÃ´ng nghá»‡': 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&auto=format&fit=crop&q=80',
    'Kinh táº¿': 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&auto=format&fit=crop&q=80',
    'Äá»i sá»‘ng': 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1200&auto=format&fit=crop&q=80',
    'AI': 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&auto=format&fit=crop&q=80',
  };
  // Thá»­ láº¥y enclosure/media:content
  const enclosure = item.enclosure?.['@_url'] || item['media:content']?.['@_url'] || null;
  return enclosure || map[category] || map['CÃ´ng nghá»‡'];
}
function estimateReadingTime(text) {
  const words = text.split(/\s+/).length;
  return Math.max(2, Math.round(words / 180));
}

// --- AI Rewrite ---
async function rewriteWithAI({ title, description, link, publisher, category, lang }) {
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || 'sk-5a0e5ecae3fc60b9f6d601fbdd60d240595e3d803d10fedfeaf2559ce715a377';
  const baseURL = process.env.AI_BASE_URL || 'https://subapi.luuvan.site/v1';
  const model = process.env.AI_MODEL || 'deepseek-v4-flash';

  // Prompt chuáº©n SEO/GEO/AEO/SDO nghiÃªm ngáº·t â€” theo tin hot háº±ng ngÃ y
  const systemPrompt = `Báº¡n lÃ  biÃªn táº­p viÃªn n0ai â€” chuyÃªn viáº¿t láº¡i tin tá»©c/blog chuáº©n SEO, GEO, AEO, SDO nghiÃªm ngáº·t, theo chá»§ Ä‘á» HOT nháº¥t má»—i ngÃ y.
YÃŠU Cáº¦U Báº®T BUá»˜C:
- Dá»±a trÃªn tin gá»‘c Ä‘ang HOT, viáº¿t láº¡i tiáº¿ng Viá»‡t, giá»ng trung tÃ­nh, E-E-A-T, khÃ´ng clickbait, giá»¯ sá»± tháº­t
- Tá»± Ä‘á»™ng chá»n gÃ³c nhÃ¬n háº¥p dáº«n nháº¥t tá»« tin hot (AI, cÃ´ng nghá»‡, kinh táº¿, Ä‘á»i sá»‘ng) Ä‘á»ƒ bÃ i cÃ³ giÃ¡ trá»‹
- Cáº¥u trÃºc nghiÃªm ngáº·t: TL;DR 1 Ä‘oáº¡n 45 tá»« + 3-4 má»¥c H2 (má»—i má»¥c 150-200 tá»«) + káº¿t luáº­n 80 tá»« + 2 FAQ chi tiáº¿t
- Má»—i bÃ i 800-1100 tá»«, Ä‘oáº¡n ngáº¯n 2-3 cÃ¢u, cÃ¢u ngáº¯n, dá»… Ä‘á»c, tá»‘i Æ°u featured snippet
- Tuyá»‡t Ä‘á»‘i khÃ´ng bá»‹a sá»‘ liá»‡u, chá»‰ dÃ¹ng thÃ´ng tin tá»« tÃ³m táº¯t gá»‘c, cÃ³ thá»ƒ má»Ÿ rá»™ng ngá»¯ cáº£nh chung nhÆ°ng khÃ´ng thÃªm sá»‘ liá»‡u giáº£
- Tráº£ vá» JSON duy nháº¥t: {"title":"...","description":"...","excerpt":"...","body":"markdown...","tags":["..."],"faq":[{"question":"...","answer":"..."}]}
- title 50-65 kÃ½ tá»± háº¥p dáº«n chuáº©n SEO, description 145-155 kÃ½ tá»±, excerpt 45-55 tá»«, tags 3-4 tá»« khÃ³a hot`;

  const userPrompt = `Gá»‘c: TiÃªu Ä‘á»: ${title}
MÃ´ táº£: ${description}
Nguá»“n: ${publisher} â€” ${link}
Category: ${category}
NgÃ´n ngá»¯ gá»‘c: ${lang}

HÃ£y viáº¿t láº¡i thÃ nh bÃ i hoÃ n chá»‰nh theo yÃªu cáº§u trÃªn.`;

  if (!apiKey) {
    // Fallback template â€” váº«n ra bÃ i há»£p lá»‡, khÃ´ng cáº§n AI
    console.log(`  â†³ No AI key â€” dÃ¹ng fallback template cho: ${title.slice(0,50)}`);
    return {
      title: title.slice(0, 75),
      description: cleanText(description).slice(0, 150) || `Cáº­p nháº­t má»›i nháº¥t vá» ${title.slice(0,40)} â€” phÃ¢n tÃ­ch ngáº¯n gá»n, cÃ³ nguá»“n kiá»ƒm chá»©ng.`,
      excerpt: cleanText(description).slice(0, 120) + ' BÃ i Ä‘Æ°á»£c tá»•ng há»£p vÃ  biÃªn táº­p, cÃ³ FAQ vÃ  nguá»“n gá»‘c rÃµ rÃ ng.',
      body: `## Tá»•ng quan\n\n${cleanText(description)}\n\nBÃ i gá»‘c Ä‘Æ°á»£c Ä‘Äƒng táº¡i [${publisher}](${link}). DÆ°á»›i Ä‘Ã¢y lÃ  tÃ³m táº¯t vÃ  phÃ¢n tÃ­ch nhanh cá»§a n0ai.\n\n## Äiá»ƒm chÃ­nh\n\n- **Bá»‘i cáº£nh:** ${cleanText(description).slice(0, 200)}\n- **TÃ¡c Ä‘á»™ng:** Ná»™i dung nÃ y áº£nh hÆ°á»Ÿng tá»›i ${category.toLowerCase()} vÃ  ngÆ°á»i dÃ¹ng cuá»‘i trong ngáº¯n háº¡n.\n- **Cáº§n theo dÃµi:** Diá»…n biáº¿n tiáº¿p theo vÃ  pháº£n á»©ng thá»‹ trÆ°á»ng.\n\n## PhÃ¢n tÃ­ch nhanh\n\nNá»™i dung gá»‘c cung cáº¥p thÃ´ng tin ban Ä‘áº§u, n0ai biÃªn táº­p láº¡i Ä‘á»ƒ dá»… Ä‘á»c, thÃªm ngá»¯ cáº£nh vÃ  cáº¥u trÃºc. ChÃºng tÃ´i giá»¯ nguyÃªn sá»± kiá»‡n, khÃ´ng thÃªm sá»‘ liá»‡u chÆ°a kiá»ƒm chá»©ng.\n\n## Káº¿t luáº­n\n\nÄÃ¢y lÃ  cáº­p nháº­t Ä‘Ã¡ng chÃº Ã½ trong lÄ©nh vá»±c ${category.toLowerCase()}. n0ai sáº½ tiáº¿p tá»¥c theo dÃµi vÃ  cáº­p nháº­t khi cÃ³ nguá»“n chÃ­nh thá»©c má»›i.\n`,
      tags: [category, publisher, 'Tin nhanh'].filter(Boolean),
      faq: [
        { question: `Nguá»“n gá»‘c cá»§a tin "${title.slice(0,40)}..." lÃ  gÃ¬?`, answer: `BÃ i Ä‘Æ°á»£c tá»•ng há»£p tá»« ${publisher} (${link}), viáº¿t láº¡i hoÃ n chá»‰nh bá»Ÿi n0ai, cÃ³ ghi nguá»“n Ä‘áº§y Ä‘á»§.` },
        { question: `VÃ¬ sao tin nÃ y quan trá»ng vá»›i ${category.toLowerCase()}?`, answer: `VÃ¬ nÃ³ pháº£n Ã¡nh xu hÆ°á»›ng má»›i trong ${category.toLowerCase()}, áº£nh hÆ°á»Ÿng tá»›i quyáº¿t Ä‘á»‹nh cá»§a ngÆ°á»i Ä‘á»c vÃ  doanh nghiá»‡p. Theo dÃµi thÃªm táº¡i nguá»“n gá»‘c.` }
      ]
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 4000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`AI ${res.status}: ${await res.text().then(t => t.slice(0,500))}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? '';
    if (!content || content.trim().length < 10) throw new Error('Empty AI content');
    // Try parse, if fails try extract JSON
    try {
      return JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      throw new Error('No JSON found: ' + content.slice(0,200));
    }
  } catch (e) {
    console.warn(`  âš  AI lá»—i, dÃ¹ng template: ${e.message}`);
    // Fallback template trá»±c tiáº¿p, khÃ´ng recurse vÃ´ háº¡n
    return {
      title: title.slice(0, 70),
      description: cleanText(description).slice(0, 150) || `Cáº­p nháº­t ${title.slice(0, 40)}`,
      excerpt: cleanText(description).slice(0, 120) + ' BÃ i Ä‘Æ°á»£c tá»•ng há»£p vÃ  biÃªn táº­p.',
      body: `## Tá»•ng quan\n\n${cleanText(description)}\n\nBÃ i gá»‘c táº¡i [${publisher}](${link}).\n\n## Äiá»ƒm chÃ­nh\n\n- **Bá»‘i cáº£nh:** ${cleanText(description).slice(0, 200)}\n- **TÃ¡c Ä‘á»™ng:** áº¢nh hÆ°á»Ÿng tá»›i ${category.toLowerCase()}.\n\n## PhÃ¢n tÃ­ch\n\nNá»™i dung Ä‘Æ°á»£c biÃªn táº­p láº¡i Ä‘á»ƒ dá»… Ä‘á»c, giá»¯ nguyÃªn sá»± kiá»‡n.\n\n## Káº¿t luáº­n\n\nCáº­p nháº­t Ä‘Ã¡ng chÃº Ã½ trong ${category.toLowerCase()}. Theo dÃµi thÃªm táº¡i nguá»“n.`,
      tags: [category, publisher],
      faq: [
        { question: `Nguá»“n cá»§a tin nÃ y?`, answer: `Tá»•ng há»£p tá»« ${publisher} (${link})` },
        { question: `VÃ¬ sao quan trá»ng?`, answer: `áº¢nh hÆ°á»Ÿng tá»›i ${category.toLowerCase()}` }
      ]
    };
  }
}

// --- Fetch RSS ---
async function fetchRSS(source) {
  console.log(`\nâ†’ Fetch ${source.publisher}: ${source.url}`);
  try {
    const res = await fetch(source.url, {
      headers: { 'User-Agent': 'n0ai-bot/1.0 (+https://news.n0ai.cloud)' },
      signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const json = parser.parse(xml);
    const channel = json.rss?.channel ?? json.feed ?? json['rdf:RDF'] ?? {};
    // RSS 2.0
    let items = channel.item ?? channel.entry ?? [];
    if (!Array.isArray(items)) items = [items];
    // Atom
    if (json.feed?.entry) items = json.feed.entry;

    const normalized = items.slice(0, 3).map(it => ({
      title: cleanText(it.title?.['#text'] ?? it.title ?? ''),
      description: cleanText(it.description?.['#text'] ?? it.description ?? it.summary?.['#text'] ?? it.summary ?? it.content?.['#text'] ?? ''),
      link: typeof it.link === 'string' ? it.link : (it.link?.['@_href'] ?? it.link?.['#text'] ?? it.guid?.['#text'] ?? it.id ?? ''),
      pubDate: it.pubDate ?? it.published ?? it.updated ?? new Date().toISOString(),
      enclosure: it.enclosure,
      media: it['media:content']
    })).filter(i => i.title && i.link);

    console.log(`  âœ“ ${normalized.length} items`);
    return normalized.map(n => ({ ...n, source }));
  } catch (e) {
    console.warn(`  âœ— Lá»—i ${source.url}: ${e.message}`);
    return [];
  }
}

// --- Main ---
async function main() {
  console.log('â”Œ n0ai ingest â€”', new Date().toISOString());
  const limit = parseInt(process.env.INGEST_LIMIT ?? '8', 10); // 8 news + 4 blog ~12 má»—i láº§n, 2 láº§n/ngÃ y ~15-16 theo yÃªu cáº§u max 15/ngÃ y
  const dryRun = process.env.DRY_RUN === '1';

  // Ensure dirs
  await fs.mkdir(BLOG_DIR, { recursive: true });
  await fs.mkdir(NEWS_DIR, { recursive: true });

  // Fetch all
  const newsItems = (await Promise.all(SOURCES.news.map(fetchRSS))).flat();
  const blogItems = (await Promise.all(SOURCES.blog.map(fetchRSS))).flat();

  // Dedupe by link
  const seen = new Set();
  const uniq = (arr) => arr.filter(i => {
    if (seen.has(i.link) || !i.title) return false;
    seen.add(i.link); return true;
  });

  const pickNews = uniq(newsItems).slice(0, limit);
  const pickBlog = uniq(blogItems).slice(0, Math.min(4, limit));

  console.log(`\nâ†’ Chá»n ${pickNews.length} news + ${pickBlog.length} blog Ä‘á»ƒ rewrite`);

  let written = 0;

  for (const item of [...pickNews.map(i => ({ ...i, dir: NEWS_DIR, type: 'news' })), ...pickBlog.map(i => ({ ...i, dir: BLOG_DIR, type: 'blog' }))]) {
    const slug = `${slugify(item.title)}-${new Date().toISOString().slice(0,10)}`;
    const filePath = path.join(item.dir, `${slug}.md`);
    try {
      await fs.access(filePath);
      console.log(`  â†· Skip exists: ${slug}`);
      continue;
    } catch {}

    const rewritten = await rewriteWithAI({
      title: item.title,
      description: item.description,
      link: item.link,
      publisher: item.source.publisher,
      category: item.source.category,
      lang: item.source.lang
    });

    const publishDate = new Date(item.pubDate).toISOString().split('T')[0];
    const cover = pickImage(item, item.source.category);

    const frontmatter = `---
title: "${rewritten.title.replace(/"/g, '\\"')}"
description: "${rewritten.description.replace(/"/g, '\\"')}"
excerpt: "${(rewritten.excerpt ?? rewritten.description).replace(/"/g, '\\"').slice(0, 250)}"
publishDate: ${publishDate}
author:
  name: "n0ai Editorial"
  role: "BiÃªn táº­p tá»± Ä‘á»™ng + Editor"
category: "${item.source.category}"
tags: [${(rewritten.tags ?? [item.source.category]).map(t => `"${t}"`).join(', ')}]
cover:
  src: "${cover}"
  alt: "${rewritten.title.replace(/"/g, '\\"')}"
  width: 1200
  height: 630
${item.type === 'news' ? `breaking: false` : 'featured: false'}
readingTime: ${estimateReadingTime(rewritten.body)}
sources:
  - title: "${item.title.replace(/"/g, '\\"')}"
    url: "${item.link}"
    publisher: "${item.source.publisher}"
faq:
${(rewritten.faq ?? []).map(f => `  - question: "${f.question.replace(/"/g, '\\"')}"\n    answer: "${f.answer.replace(/"/g, '\\"')}"`).join('\n')}
---

${rewritten.body}

---
*BÃ i Ä‘Æ°á»£c tá»•ng há»£p tá»« [${item.source.publisher}](${item.link}), viáº¿t láº¡i hoÃ n chá»‰nh bá»Ÿi n0ai. Cáº­p nháº­t tá»± Ä‘á»™ng lÃºc ${new Date().toLocaleString('vi-VN')}.*
`;

    if (dryRun) {
      console.log(`  [dry] would write ${filePath}`);
    } else {
      await fs.writeFile(filePath, frontmatter, 'utf-8');
      console.log(`  âœ“ Wrote ${item.type}/${slug}.md`);
      written++;
    }
    // Rate limit AI
    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`\nâ”” Done â€” wrote ${written} files. Run: npm run build`);
  if (written > 0 && !dryRun) {
    console.log('  â†’ Next: git add . && git commit -m "chore: auto ingest $(date)" && npm run build');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
