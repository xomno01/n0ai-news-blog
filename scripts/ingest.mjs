#!/usr/bin/env node
/**
 * n0ai — Daily auto ingest
 * - Fetch RSS từ nguồn uy tín hằng ngày
 * - Rewrite thành bài hoàn chỉnh chuẩn SEO/SDO/GEO/AEO
 * - Ghi ra markdown vào src/content/blog|news
 * 
 * Chạy: node scripts/ingest.mjs
 * Cron: 0 6,18 * * * (06:00 & 18:00 ICT)
 * 
 * AI: ưu tiên thueapi.luuvan.site / subapi.luuvan.site (OpenAI-compatible)
 * Fallback: template rewrite nếu không có API key
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';

const ROOT = path.resolve(import.meta.dirname, '..');
const BLOG_DIR = path.join(ROOT, 'src/content/blog');
const NEWS_DIR = path.join(ROOT, 'src/content/news');

// --- Cấu hình nguồn — theo tin HOT hằng ngày ---
const SOURCES = {
  news: [
    { url: 'https://vnexpress.net/rss/tin-moi-nhat.rss', category: 'Đời sống', publisher: 'VnExpress', lang: 'vi' },
    { url: 'https://vnexpress.net/rss/tin-nong.rss', category: 'Đời sống', publisher: 'VnExpress', lang: 'vi' },
    { url: 'https://vnexpress.net/rss/kinh-doanh.rss', category: 'Kinh tế', publisher: 'VnExpress', lang: 'vi' },
    { url: 'https://vnexpress.net/rss/khoa-hoc.rss', category: 'Công nghệ', publisher: 'VnExpress', lang: 'vi' },
    { url: 'https://vnexpress.net/rss/the-gioi.rss', category: 'Đời sống', publisher: 'VnExpress', lang: 'vi' },
    { url: 'https://cafebiz.vn/rss/home.rss', category: 'Kinh tế', publisher: 'CafeBiz', lang: 'vi' },
    { url: 'https://tuoitre.vn/rss/tin-moi-nhat.rss', category: 'Đời sống', publisher: 'Tuổi Trẻ', lang: 'vi' },
    { url: 'https://thanhnien.vn/rss/home.rss', category: 'Đời sống', publisher: 'Thanh Niên', lang: 'vi' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', category: 'Công nghệ', publisher: 'NYTimes', lang: 'en' },
    { url: 'https://www.theverge.com/rss/index.xml', category: 'Công nghệ', publisher: 'The Verge', lang: 'en' },
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
  // Map category -> unsplash fallback (đảm bảo luôn có ảnh đẹp, CLS 0)
  const map = {
    'Công nghệ': 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&auto=format&fit=crop&q=80',
    'Kinh tế': 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&auto=format&fit=crop&q=80',
    'Đời sống': 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1200&auto=format&fit=crop&q=80',
    'AI': 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&auto=format&fit=crop&q=80',
  };
  // Thử lấy enclosure/media:content
  const enclosure = item.enclosure?.['@_url'] || item['media:content']?.['@_url'] || null;
  return enclosure || map[category] || map['Công nghệ'];
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

  // Prompt chuẩn SEO/GEO/AEO/SDO nghiêm ngặt — theo tin hot hằng ngày
  const systemPrompt = `Bạn là biên tập viên n0ai — chuyên viết lại tin tức/blog chuẩn SEO, GEO, AEO, SDO nghiêm ngặt, theo chủ đề HOT nhất mỗi ngày.
YÊU CẦU BẮT BUỘC:
- Dựa trên tin gốc đang HOT, viết lại tiếng Việt, giọng trung tính, E-E-A-T, không clickbait, giữ sự thật
- Tự động chọn góc nhìn hấp dẫn nhất từ tin hot (AI, công nghệ, kinh tế, đời sống) để bài có giá trị
- Cấu trúc nghiêm ngặt: TL;DR 1 đoạn 45 từ + 3-4 mục H2 (mỗi mục 150-200 từ) + kết luận 80 từ + 2 FAQ chi tiết
- Mỗi bài 800-1100 từ, đoạn ngắn 2-3 câu, câu ngắn, dễ đọc, tối ưu featured snippet
- Tuyệt đối không bịa số liệu, chỉ dùng thông tin từ tóm tắt gốc, có thể mở rộng ngữ cảnh chung nhưng không thêm số liệu giả
- Trả về JSON duy nhất: {"title":"...","description":"...","excerpt":"...","body":"markdown...","tags":["..."],"faq":[{"question":"...","answer":"..."}]}
- title 50-65 ký tự hấp dẫn chuẩn SEO, description 145-155 ký tự, excerpt 45-55 từ, tags 3-4 từ khóa hot`;

  const userPrompt = `Gốc: Tiêu đề: ${title}
Mô tả: ${description}
Nguồn: ${publisher} — ${link}
Category: ${category}
Ngôn ngữ gốc: ${lang}

Hãy viết lại thành bài hoàn chỉnh theo yêu cầu trên.`;

  if (!apiKey) {
    // Fallback template — vẫn ra bài hợp lệ, không cần AI
    console.log(`  ↳ No AI key — dùng fallback template cho: ${title.slice(0,50)}`);
    return {
      title: title.slice(0, 75),
      description: cleanText(description).slice(0, 150) || `Cập nhật mới nhất về ${title.slice(0,40)} — phân tích ngắn gọn, có nguồn kiểm chứng.`,
      excerpt: cleanText(description).slice(0, 120) + ' Bài được tổng hợp và biên tập, có FAQ và nguồn gốc rõ ràng.',
      body: `## Tổng quan\n\n${cleanText(description)}\n\nBài gốc được đăng tại [${publisher}](${link}). Dưới đây là tóm tắt và phân tích nhanh của n0ai.\n\n## Điểm chính\n\n- **Bối cảnh:** ${cleanText(description).slice(0, 200)}\n- **Tác động:** Nội dung này ảnh hưởng tới ${category.toLowerCase()} và người dùng cuối trong ngắn hạn.\n- **Cần theo dõi:** Diễn biến tiếp theo và phản ứng thị trường.\n\n## Phân tích nhanh\n\nNội dung gốc cung cấp thông tin ban đầu, n0ai biên tập lại để dễ đọc, thêm ngữ cảnh và cấu trúc. Chúng tôi giữ nguyên sự kiện, không thêm số liệu chưa kiểm chứng.\n\n## Kết luận\n\nĐây là cập nhật đáng chú ý trong lĩnh vực ${category.toLowerCase()}. n0ai sẽ tiếp tục theo dõi và cập nhật khi có nguồn chính thức mới.\n`,
      tags: [category, publisher, 'Tin nhanh'].filter(Boolean),
      faq: [
        { question: `Nguồn gốc của tin "${title.slice(0,40)}..." là gì?`, answer: `Bài được tổng hợp từ ${publisher} (${link}), viết lại hoàn chỉnh bởi n0ai, có ghi nguồn đầy đủ.` },
        { question: `Vì sao tin này quan trọng với ${category.toLowerCase()}?`, answer: `Vì nó phản ánh xu hướng mới trong ${category.toLowerCase()}, ảnh hưởng tới quyết định của người đọc và doanh nghiệp. Theo dõi thêm tại nguồn gốc.` }
      ]
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 2500,
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
    console.warn(`  ⚠ AI lỗi, dùng template: ${e.message}`);
    // Fallback template trực tiếp, không recurse vô hạn
    return {
      title: title.slice(0, 70),
      description: cleanText(description).slice(0, 150) || `Cập nhật ${title.slice(0, 40)}`,
      excerpt: cleanText(description).slice(0, 120) + ' Bài được tổng hợp và biên tập.',
      body: `## Tổng quan\n\n${cleanText(description)}\n\nBài gốc tại [${publisher}](${link}).\n\n## Điểm chính\n\n- **Bối cảnh:** ${cleanText(description).slice(0, 200)}\n- **Tác động:** Ảnh hưởng tới ${category.toLowerCase()}.\n\n## Phân tích\n\nNội dung được biên tập lại để dễ đọc, giữ nguyên sự kiện.\n\n## Kết luận\n\nCập nhật đáng chú ý trong ${category.toLowerCase()}. Theo dõi thêm tại nguồn.`,
      tags: [category, publisher],
      faq: [
        { question: `Nguồn của tin này?`, answer: `Tổng hợp từ ${publisher} (${link})` },
        { question: `Vì sao quan trọng?`, answer: `Ảnh hưởng tới ${category.toLowerCase()}` }
      ]
    };
  }
}

// --- Fetch RSS ---
async function fetchRSS(source) {
  console.log(`\n→ Fetch ${source.publisher}: ${source.url}`);
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

    console.log(`  ✓ ${normalized.length} items`);
    return normalized.map(n => ({ ...n, source }));
  } catch (e) {
    console.warn(`  ✗ Lỗi ${source.url}: ${e.message}`);
    return [];
  }
}

// --- Main ---
async function main() {
  console.log('┌ n0ai ingest —', new Date().toISOString());
  const limit = parseInt(process.env.INGEST_LIMIT ?? '8', 10); // 8 news + 4 blog ~12 mỗi lần, 2 lần/ngày ~15-16 theo yêu cầu max 15/ngày
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

  console.log(`\n→ Chọn ${pickNews.length} news + ${pickBlog.length} blog để rewrite`);

  let written = 0;

  for (const item of [...pickNews.map(i => ({ ...i, dir: NEWS_DIR, type: 'news' })), ...pickBlog.map(i => ({ ...i, dir: BLOG_DIR, type: 'blog' }))]) {
    const slug = `${slugify(item.title)}-${new Date().toISOString().slice(0,10)}`;
    const filePath = path.join(item.dir, `${slug}.md`);
    try {
      await fs.access(filePath);
      console.log(`  ↷ Skip exists: ${slug}`);
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
  role: "Biên tập tự động + Editor"
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
*Bài được tổng hợp từ [${item.source.publisher}](${item.link}), viết lại hoàn chỉnh bởi n0ai. Cập nhật tự động lúc ${new Date().toLocaleString('vi-VN')}.*
`;

    if (dryRun) {
      console.log(`  [dry] would write ${filePath}`);
    } else {
      await fs.writeFile(filePath, frontmatter, 'utf-8');
      console.log(`  ✓ Wrote ${item.type}/${slug}.md`);
      written++;
    }
    // Rate limit AI
    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`\n└ Done — wrote ${written} files. Run: npm run build`);
  if (written > 0 && !dryRun) {
    console.log('  → Next: git add . && git commit -m "chore: auto ingest $(date)" && npm run build');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
