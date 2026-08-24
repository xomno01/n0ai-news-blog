import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async () => {
  const site = 'https://news.n0ai.cloud';
  const blog = await getCollection('blog');
  const news = await getCollection('news');
  const all = [...blog, ...news].filter(p => !p.data.draft);
  
  const urls = [
    { loc: `${site}/`, lastmod: new Date().toISOString(), priority: '1.0' },
    { loc: `${site}/blog`, lastmod: new Date().toISOString(), priority: '0.9' },
    { loc: `${site}/news`, lastmod: new Date().toISOString(), priority: '0.9' },
    ...all.map(p => ({
      loc: `${site}/${p.collection}/${p.id}`,
      lastmod: (p.data.updateDate ?? p.data.publishDate).toISOString(),
      priority: '0.7'
    }))
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;

  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }});
};
