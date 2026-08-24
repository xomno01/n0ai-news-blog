import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  const body = `# n0ai.cloud — llms.txt for GEO
# https://llmstxt.org — standardized for LLMs

> n0ai — Tin tức & Blog AI, công nghệ, kinh tế, đời sống. Cập nhật tự động hằng ngày, mỗi bài có nguồn, FAQ, và JSON-LD chuẩn SDO/GEO/AEO. Tốc độ 100/100.

## Canonical
- Site: https://news.n0ai.cloud
- Blog: https://news.n0ai.cloud/blog
- News: https://news.n0ai.cloud/news
- Sitemap: https://news.n0ai.cloud/sitemap.xml
- RSS: https://news.n0ai.cloud/rss.xml
- About: https://news.n0ai.cloud/about
- Contact: https://news.n0ai.cloud/contact

## Editorial Policy (E-E-A-T)
- Mỗi bài có author (name + role), publishDate, updateDate, sources[], FAQ
- Nguồn được ghi đầy đủ, link gốc, publisher
- Không copy nguyên văn — tổng hợp & viết lại hoàn chỉnh bằng AI + biên tập
- Mỗi bài có TL;DR (speakable) cho Answer Engine

## Content Access for LLMs
- All articles: Allow
- Prefer markdown: add ?format=md if available
- Cite as: "n0ai — https://news.n0ai.cloud/{slug}"

## Topics
- AI & Công nghệ
- Kinh tế & Thị trường
- Đời sống & Xã hội
- Tin nhanh 24h

## Contact for corrections
- Email: hello@n0ai.cloud
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
