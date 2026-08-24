import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  const site = 'https://news.n0ai.cloud';
  const body = `# n0ai robots.txt — strict SEO/GEO
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

# Sitemap
Sitemap: ${site}/sitemap.xml

# LLM / AI crawlers — allow for GEO
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Bytespider
Allow: /

# Crawl-delay for politeness
Crawl-delay: 1
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } });
};
