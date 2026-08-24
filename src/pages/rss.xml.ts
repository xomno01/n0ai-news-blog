import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async (context) => {
  const blog = await getCollection('blog');
  const news = await getCollection('news');
  const all = [...blog, ...news]
    .filter(p => !p.data.draft)
    .sort((a,b) => b.data.publishDate.getTime() - a.data.publishDate.getTime())
    .slice(0, 50);

  return rss({
    title: 'n0ai — News & Blog',
    description: 'Tin nhanh & blog AI cập nhật hằng ngày. Chuẩn SEO/GEO/AEO/SDO, 100/100 PageSpeed.',
    site: context.site ?? 'https://news.n0ai.cloud',
    items: all.map(post => ({
      title: post.data.title,
      description: post.data.description,
      link: `/${post.collection}/${post.id}/`,
      pubDate: post.data.publishDate,
      categories: [post.data.category, ...post.data.tags],
      author: post.data.author.name,
    })),
    customData: `<language>vi</language>`,
  });
};
