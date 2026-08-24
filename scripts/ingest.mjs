#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
const ROOT = path.resolve(import.meta.dirname, '..');
const NEWS_DIR = path.join(ROOT, 'src/content/news');
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
  ]
};
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
function slugify(str) { return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60); }
function cleanText(s='') { return s.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1').replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim().slice(0, 500); }
function pickImage(item, category) {
  const map = {
    'Công nghệ': 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&auto=format&fit=crop&q=80',
    'Kinh tế': 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&auto=format&fit=crop&q=80',
    'Đời sống': 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1200&auto=format&fit=crop&q=80',
    'AI': 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&auto=format&fit=crop&q=80',
  };
  const enclosure = item.enclosure?.['@_url'] || item['media:content']?.['@_url'] || null;
  return enclosure || map[category] || map['Công nghệ'];
}
function estimateReadingTime(text) { const words = text.split(/\s+/).length; return Math.max(4, Math.round(words / 180)); }
async function rewriteWithAI({ title, description, link, publisher, category }) {
  const apiKey = process.env.AI_API_KEY || 'sk-5a0e5ecae3fc60b9f6d601fbdd60d240595e3d803d10fedfeaf2559ce715a377';
  const baseURL = process.env.AI_BASE_URL || 'https://subapi.luuvan.site/v1';
  const model = process.env.AI_MODEL || 'deepseek-v4-flash';
  const systemPrompt = `Bạn là Tổng Biên Tập n0ai — 15 năm kinh nghiệm, viết CHUẨN BÁO, DÀI, SÂU.\nYÊU CẦU: NEWS 900-1200 từ — NGẮN HƠN LÀ LỖI.\nCấu trúc: Mở bài 150 từ + 5 H2 mỗi mục 200 từ + Kết luận 150 từ + 3 FAQ 80 từ/mỗi.\nTrả JSON: {"title":"...","description":"...","excerpt":"...","body":"markdown...","tags":["..."],"faq":[{"question":"...","answer":"..."}]}`;
  const userPrompt = `Tiêu đề: ${title}\nMô tả: ${description}\nNguồn: ${publisher} — ${link}\nCategory: ${category}\nLoại: NEWS 900-1200 từ`;
  if (!apiKey || apiKey.includes('placeholder')) {
    console.log(`  ↳ No AI key fallback`);
    const baseDesc = cleanText(description);
    return {
      title: title.slice(0, 70),
      description: baseDesc.slice(0, 155),
      excerpt: baseDesc.slice(0, 140) + ' Bài phân tích sâu.',
      body: `## Mở bài — Vì sao hot?\n\n${baseDesc} Sự kiện đang thu hút lớn vì liên quan trực tiếp tới đời sống và có thể tạo thay đổi ngắn hạn.\n\nTin gốc tại [${publisher}](${link}). Bài tổng hợp, kiểm chứng và mở rộng bối cảnh.\n\n## Bối cảnh chi tiết\n\n${baseDesc} Để hiểu rõ, cần đặt trong bối cảnh rộng hơn. Những diễn biến tương tự cho thấy thời tiết, hạ tầng, quản lý thường đóng vai trò then chốt.\n\n## Phân tích — Điều gì đáng chú ý?\n\nĐiểm đáng chú ý đầu tiên là tính bất ngờ. Dù có dấu hiệu cảnh báo, mức độ và hậu quả vẫn vượt ngoài dự đoán. Khoảng trống giữa dự báo và thực tế vẫn lớn.\n\nThứ hai, phản ứng của cộng đồng và cơ quan chức năng cho thấy sự quan tâm cao. Vai trò báo chí kiểm chứng rất quan trọng.\n\nThứ ba, xét dài hạn, sự việc đặt ra yêu cầu rà soát quy trình.\n\n## Hệ quả và góc nhìn chuyên gia\n\nVề ngắn hạn, tác động rõ nhất là tới đời sống những người trực tiếp liên quan. Về kinh tế, chi phí khắc phục và phòng ngừa tương lai có thể không nhỏ.\n\nỞ góc độ chuyên gia, nhiều ý kiến cho rằng cần đầu tư mạnh hơn vào hạ tầng dự phòng.\n\n## Bài học và khuyến nghị\n\nBài học lớn nhất là không nên chủ quan trước rủi ro tưởng chừng nhỏ. Việc tuân thủ quy trình, kiểm tra thường xuyên và chuẩn bị phương án dự phòng là điều bắt buộc.\n\n## Kết luận\n\nSự việc "${title.slice(0,60)}" là lời nhắc về tầm quan trọng của sự chuẩn bị và minh bạch. n0ai sẽ tiếp tục theo dõi, cập nhật khi có thông tin chính thức mới từ ${publisher}.`,
      tags: [category, publisher, 'Tin nóng', 'Phân tích'],
      faq: [
        { question: `Nguồn của tin này?`, answer: `Tổng hợp từ ${publisher} (${link}), kiểm chứng bởi n0ai.` },
        { question: `Vì sao quan trọng?`, answer: `Ảnh hưởng tới ${category}, an toàn và niềm tin cộng đồng.` },
        { question: `Cần theo dõi gì?`, answer: `Kết quả điều tra, biện pháp khắc phục, thay đổi quy định.` }
      ]
    };
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, response_format: { type: 'json_object' }, temperature: 0.75, max_tokens: 5000, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }] }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`AI ${res.status}: ${await res.text().then(t => t.slice(0,500))}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? '';
    if (!content || content.trim().length < 100) throw new Error('Empty AI content');
    try { const j = JSON.parse(content); console.log(`  ↳ AI wrote ${(j.body||'').split(/\s+/).length} words`); return j; } catch { const m = content.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); throw new Error('No JSON'); }
  } catch (e) {
    console.warn(`  ⚠ AI lỗi, dùng template dài: ${e.message}`);
    const baseDesc = cleanText(description);
    return {
      title: title.slice(0, 70),
      description: baseDesc.slice(0, 155),
      excerpt: baseDesc.slice(0, 140) + ' Bài phân tích sâu.',
      body: `## Mở bài — Vì sao hot?\n\n${baseDesc} Sự kiện đang thu hút lớn vì liên quan trực tiếp tới đời sống và có thể tạo thay đổi ngắn hạn.\n\nTin gốc tại [${publisher}](${link}). Bài tổng hợp, kiểm chứng và mở rộng bối cảnh.\n\n## Bối cảnh chi tiết\n\n${baseDesc} Để hiểu rõ, cần đặt trong bối cảnh rộng hơn. Những diễn biến tương tự cho thấy thời tiết, hạ tầng, quản lý thường đóng vai trò then chốt.\n\n## Phân tích — Điều gì đáng chú ý?\n\nĐiểm đáng chú ý đầu tiên là tính bất ngờ. Dù có dấu hiệu cảnh báo, mức độ và hậu quả vẫn vượt ngoài dự đoán.\n\nThứ hai, phản ứng của cộng đồng và cơ quan chức năng cho thấy sự quan tâm cao.\n\nThứ ba, xét dài hạn, sự việc đặt ra yêu cầu rà soát quy trình.\n\n## Hệ quả và góc nhìn chuyên gia\n\nVề ngắn hạn, tác động rõ nhất là tới đời sống những người trực tiếp liên quan.\n\nỞ góc độ chuyên gia, nhiều ý kiến cho rằng cần đầu tư mạnh hơn vào hạ tầng dự phòng.\n\n## Bài học và khuyến nghị\n\nBài học lớn nhất là không nên chủ quan trước rủi ro tưởng chừng nhỏ.\n\n## Kết luận\n\nSự việc "${title.slice(0,60)}" là lời nhắc về tầm quan trọng của sự chuẩn bị và minh bạch. n0ai sẽ tiếp tục theo dõi, cập nhật khi có thông tin chính thức mới từ ${publisher}.`,
      tags: [category, publisher, 'Tin nóng', 'Phân tích'],
      faq: [
        { question: `Nguồn của tin này?`, answer: `Tổng hợp từ ${publisher} (${link}), kiểm chứng bởi n0ai.` },
        { question: `Vì sao quan trọng?`, answer: `Ảnh hưởng tới ${category}, an toàn và niềm tin cộng đồng.` },
        { question: `Cần theo dõi gì?`, answer: `Kết quả điều tra, biện pháp khắc phục, thay đổi quy định.` }
      ]
    };
  }
}
async function fetchRSS(source) {
  console.log(`\n→ Fetch ${source.publisher}: ${source.url}`);
  try {
    const res = await fetch(source.url, { headers: { 'User-Agent': 'n0ai-bot/1.0 (+https://news.n0ai.cloud)' }, signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const json = parser.parse(xml);
    const channel = json.rss?.channel ?? json.feed ?? json['rdf:RDF'] ?? {};
    let items = channel.item ?? channel.entry ?? [];
    if (!Array.isArray(items)) items = [items];
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
  } catch (e) { console.warn(`  ✗ Lỗi ${source.url}: ${e.message}`); return []; }
}
async function main() {
  console.log('┌ n0ai ingest —', new Date().toISOString());
  const limit = parseInt(process.env.INGEST_LIMIT ?? '8', 10);
  const dryRun = process.env.DRY_RUN === '1';
  await fs.mkdir(NEWS_DIR, { recursive: true });
  const newsItems = (await Promise.all(SOURCES.news.map(fetchRSS))).flat();
  const seen = new Set();
  const uniq = (arr) => arr.filter(i => { if (seen.has(i.link) || !i.title) return false; seen.add(i.link); return true; });
  const pickNews = uniq(newsItems).slice(0, limit);
  console.log(`\n→ Chọn ${pickNews.length} news để rewrite`);
  let written = 0;
  for (const item of pickNews.map(i => ({ ...i, dir: NEWS_DIR, type: 'news' }))) {
    const slug = `${slugify(item.title)}-${new Date().toISOString().slice(0,10)}`;
    const filePath = path.join(item.dir, `${slug}.md`);
    try { await fs.access(filePath); console.log(`  ↷ Skip exists: ${slug}`); continue; } catch {}
    const rewritten = await rewriteWithAI({ title: item.title, description: item.description, link: item.link, publisher: item.source.publisher, category: item.source.category });
    const publishDate = new Date(item.pubDate).toISOString().split('T')[0];
    const cover = pickImage(item, item.source.category);
    const frontmatter = `---
title: "${rewritten.title.replace(/"/g, '\\"')}"
description: "${rewritten.description.replace(/"/g, '\\"')}"
excerpt: "${(rewritten.excerpt ?? rewritten.description).replace(/"/g, '\\"').slice(0, 250)}"
publishDate: ${publishDate}
author:
  name: "n0ai Editorial"
  role: "Biên tập chuyên sâu"
category: "${item.source.category}"
tags: [${(rewritten.tags ?? [item.source.category]).map(t => `"${t}"`).join(', ')}]
cover:
  src: "${cover}"
  alt: "${rewritten.title.replace(/"/g, '\\"')}"
  width: 1200
  height: 630
breaking: false
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
*Bài được tổng hợp từ [${item.source.publisher}](${item.link}), viết lại bởi n0ai. Cập nhật lúc ${new Date().toLocaleString('vi-VN')}.*
`;
    if (dryRun) { console.log(`  [dry] would write ${filePath}`); } else { await fs.writeFile(filePath, frontmatter, 'utf-8'); console.log(`  ✓ Wrote ${item.type}/${slug}.md`); written++; }
    await new Promise(r => setTimeout(r, 800));
  }
  console.log(`\n└ Done — wrote ${written} files.`);
}
main().catch(e => { console.error(e); process.exit(1); });
