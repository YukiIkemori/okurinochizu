import content from './content.json';
import sourceRegistry from './sources.json';
import type { Article, Region, Source } from './types';

export const site = {
  name: 'おくりの地図',
  url: 'https://okurinochizu.jp',
  description: '長野県の東信と群馬県の西毛、11地域の葬儀・家族葬・お墓・終活を案内する情報メディア。費用、病院からの搬送、自治体の手続きまで、わかりやすくまとめます。',
  gaId: import.meta.env.PUBLIC_GA_MEASUREMENT_ID || 'G-YH2YL4ZMCH',
};
export const articles = content.articles as Article[];
export const regions = content.regions as Region[];
export const categories = [
  { slug: 'urgent', name: 'いま、必要なこと', short: '搬送・最初の手順', description: '病院からの搬送、安置、最初の連絡。急いでいるときに、ひとつずつ確認できる案内です。', number: '01' },
  { slug: 'funeral', name: '葬儀を考える', short: '家族葬・葬儀社選び', description: '家族葬、一日葬、直葬の違いと、葬儀社を選ぶときの確認事項を整理します。', number: '02' },
  { slug: 'cost', name: '費用と備え', short: '見積もり・給付・互助会', description: '広告の価格から総額へ。見積もり、葬祭費の申請、互助会の契約を確かめます。', number: '03' },
  { slug: 'cemetery', name: 'お墓と供養', short: '樹木葬・永代供養', description: '樹木葬、永代供養、墓じまい。名前だけではわからない契約と供養の形を読み解きます。', number: '04' },
  { slug: 'planning', name: 'これからの支度', short: '事前相談・終活', description: 'まだ決めなくても大丈夫。家族に伝えることや、事前相談で聞いておきたいことをまとめます。', number: '05' },
  { slug: 'procedures', name: '手続きと参列', short: '届出・香典・遠方の家族', description: '死亡届、火葬許可、参列の連絡。役所の手続きと、人への伝え方を確認します。', number: '06' },
];
/** Reader needs used to group guides on the home page and the guide index. Every category belongs to one group. */
export const needs = [
  { id: 'funeral', name: '葬儀の前後', categories: ['urgent', 'funeral'], featured: ['family-funeral', 'funeral-schedule', 'choose-funeral-company'] },
  { id: 'money', name: '費用とお金', categories: ['cost'], featured: ['funeral-cost', 'estimate-checklist', 'funeral-benefit'] },
  { id: 'procedures', name: '手続き', categories: ['procedures'], featured: ['death-procedures', 'cremation-permit', 'funeral-etiquette'] },
  { id: 'grave', name: 'お墓と終活', categories: ['cemetery', 'planning'], featured: ['tree-burial', 'grave-closure', 'preconsultation'] },
];
export const articlesForNeed = (need: (typeof needs)[number]) => articles.filter(article => need.categories.includes(article.category));
/** The guides for a reader whose family member has just died, in the order they are needed. */
export const urgentEntries = [
  { slug: 'hospital-transport', when: '病院で亡くなったとき' },
  { slug: 'home-death', when: '自宅で亡くなったとき' },
  { slug: 'first-day', when: '最初に何をするか知りたいとき' },
  { slug: 'funeral-flow', when: '火葬・納骨までの流れを知りたいとき' },
];
/** Region pages and urgent guides show the one-row consultation line near the top (README). */
export const hasTopReferral = (article: Article) => article.category === 'urgent';
export const articleUrl = (slug: string) => '/guides/' + slug + '/';
export const articleListTitle = (article: Article) => article.title.split('｜')[0].trim();
export const regionUrl = (slug: string) => '/regions/' + slug + '/';
export const categoryName = (slug: string) => categories.find(c => c.slug === slug)?.name || slug;

// The source note links only pages the build validator allows as ordinary links. The referred company's
// own pages are reached only through the one measured referral, and competing funeral/cemetery
// introduction sites are never linked (same host lists as scripts/validate-build.mjs; see README).
const providerHosts = ['so-gi.com', 'www.so-gi.com'];
const competingHosts = ['mitsuwa-sougi.co.jp', 'soogi.jp', 'ansinsougi.jp', 'e-ohaka.com', 'lifedot.jp', 'e-sogi.com', 'osohshiki.jp'];
const listable = (url: string) => {
  const { hostname } = new URL(url);
  return !providerHosts.includes(hostname) && !competingHosts.some(host => hostname === host || hostname.endsWith('.' + host));
};
const sourceById = new Map((sourceRegistry as Source[]).map(source => [source.id, source]));
/** An article's or region's recorded sources, in their recorded order, that may be linked publicly. */
export const publicSources = (ids: string[]) => ids.flatMap(id => {
  const source = sourceById.get(id);
  if (!source) throw new Error(`Unknown source ID: ${id}`);
  return listable(source.url) ? [source] : [];
});
/** "2026-11-10" -> "2026年11月10日", read from the recorded string without time-zone conversion. */
export const japaneseDate = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return `${year}年${month}月${day}日`;
};
