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
/** `topLabel` (region pages only): the link text of the top consultation row, naming what the
 *  destination page actually shows, e.g. 「佐久市の式場と費用を見る（つばさ公益社）」. Without it the row
 *  uses the generic 「つばさ公益社のページを見る」. The allowed wordings are listed in the README. */
export type Referral = { href: string; label: string; note: string; topLabel?: string };
/** One row of a region's or facility's 早見表. With `href`, the whole value becomes the link: `tel:` +
 *  digits for a public office's (or the public facility's own) phone number, or the https URL of one of
 *  the page's recorded sources. */
export type QuickFact = { label: string; value: string; href?: string };
export type Article = {
  slug: string; title: string; description: string; category: string;
  answer: string; lead: string; sections: Section[];
  faq: { q: string; a: string }[]; sources: string[];
  related: string[]; regions: string[]; keywords: string[]; referral: Referral;
  inlineReferralAfter?: string;
  /** 「まず知っておきたいこと」: 3–5 short points restating facts already in this article. */
  keyPoints?: string[];
  publishedAt: string; updatedAt: string;
};
export type Region = {
  slug: string; name: string; prefecture: string; description: string;
  pageTitle: string; heading: string;
  lead: string; focus: string; sections: Section[]; sources: string[];
  related: string[]; referral: Referral; updatedAt: string;
  /** Section id followed by the one-sentence consultation note (placement `in-article`), as on guides. */
  inlineReferralAfter?: string;
  /** 「まず知っておきたいこと」: 3–5 short points restating facts already on this page. */
  keyPoints?: string[];
  /** 「早見表」: the page's key numbers and offices, restating facts already on this page. */
  quickFacts?: QuickFact[];
};
/** A public crematorium or funeral facility (`/facilities/<slug>/`). The page reuses the region page's
 *  parts; it has no top consultation row and no in-article note, and its end block is the referral of
 *  the region where the facility stands (`region`), so no referral is recorded here. */
export type Facility = {
  slug: string; name: string;
  /** Slug of the region page of the municipality where the facility stands. */
  region: string;
  /** Slugs of the region pages whose residents use the facility, in the order they are listed. */
  regions: string[];
  /** The address and phone number the operator publishes; used for the page's structured data. */
  postalCode: string; prefecture: string; locality: string; street: string; phone: string;
  pageTitle: string; heading: string; description: string;
  /** One line for lists (the facility index, the region index and region pages). */
  summary: string;
  lead: string; sections: Section[]; sources: string[];
  /** Guide slugs listed under 関連記事. */
  related: string[];
  keyPoints: string[]; quickFacts: QuickFact[];
  publishedAt: string; updatedAt: string;
};
