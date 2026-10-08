import type { APIRoute } from 'astro';
import { site, articles, regions, categories, articleUrl, regionUrl } from '../data/site';
export const GET: APIRoute = () => {
  const pages = [
    ...['/', '/guides/', '/regions/', '/about/', '/privacy/'].map(path => ({ path, lastmod: '' })),
    ...categories.map(c => ({ path: '/topics/' + c.slug + '/', lastmod: '' })),
    ...articles.map(a => ({ path: articleUrl(a.slug), lastmod: a.updatedAt })),
    ...regions.map(r => ({ path: regionUrl(r.slug), lastmod: r.updatedAt })),
  ];
  const body = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + pages.map(p => '<url><loc>' + site.url + p.path + '</loc>' + (p.lastmod ? '<lastmod>' + p.lastmod + '</lastmod>' : '') + '</url>').join('') + '</urlset>';
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
