export type InlineLink = { text: string; href: string };
export type Section = {
  id: string;
  aliases?: string[];
  heading: string;
  paragraphs: string[];
  paragraphLinks?: (InlineLink & { paragraph: number })[];
  bullets?: string[];
  ordered?: boolean;
  table?: { headers: string[]; rows: string[][]; links?: (InlineLink & { row: number; column: number })[] };
  note?: string;
};
export type Source = { id: string; title: string; url: string; checkedAt: string; note?: string };
export type Referral = { href: string; label: string; note: string };
export type Article = {
  slug: string; title: string; description: string; category: string;
  answer: string; lead: string; sections: Section[];
  faq: { q: string; a: string }[]; sources: string[];
  related: string[]; regions: string[]; keywords: string[]; referral: Referral;
  publishedAt: string; updatedAt: string;
};
export type Region = {
  slug: string; name: string; prefecture: string; description: string;
  pageTitle: string; heading: string;
  lead: string; focus: string; sections: Section[]; sources: string[];
  related: string[]; referral: Referral; updatedAt: string;
};
