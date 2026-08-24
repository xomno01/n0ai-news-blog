import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async (context) => {
  const news = await getCollection('news');
  const all = [...news]
    .filter(p => !p.data.draft)
    .sort((a,b) => b.data.publishDate.getTime() - a.data.publishDate.getTime())
    .slice(0, 50);

  return rss({
    title: 'n0ai NEWS — 30 bài/ngày',
    description: 'n0ai NEWS 100% news: 30 bài/ngày, 900-1200 từ, dense, cập nhật 00/06/12/18h ICT.',
    site: context.site ?? 'https://news.n0ai.cloud',
    items: all.map(post => ({
      title: post.data.title,
      description: post.data.description,
      link: `/news/${post.id}/`,
      pubDate: post.data.publishDate,
      categories: [post.data.category, ...post.data.tags],
      author: post.data.author.name,
    })),
    customData: `<language>vi</language>`,
  });
};