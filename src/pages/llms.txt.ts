import type { APIRoute } from 'astro';
import { site, articles, regions, articleUrl, regionUrl } from '../data/site';
export const GET: APIRoute = () => new Response(
  '# おくりの地図\n\n> 長野県東信と群馬県西毛の葬儀・お墓・終活の地域案内。\n\n## 地域の案内\n' +
  regions.map(r => '- [' + r.name + '](' + site.url + regionUrl(r.slug) + '): ' + r.description).join('\n') +
  '\n\n## 実用記事\n' + articles.map(a => '- [' + a.title + '](' + site.url + articleUrl(a.slug) + '): ' + a.description).join('\n') +
  '\n\n## 編集方針\n- [このメディアについて](' + site.url + '/about/)\n',
  { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
);
