import type { ImageMetadata } from 'astro';
import landscape from '../assets/editorial/landscape.png';
import flowers from '../assets/editorial/flowers.png';
import woodland from '../assets/editorial/woodland.png';
import stillLife from '../assets/editorial/still-life.png';

export type EditorialKind = 'home-hero' | 'guides-header' | 'regions-header' | 'about-header'
  | `guide-${string}-${'header' | 'interlude'}` | `region-${string}-${'header' | 'interlude'}`;

const uniqueImages = import.meta.glob<{ default: ImageMetadata }>('../assets/editorial/unique/*.webp', { eager: true });
const editorialImages: Record<string, ImageMetadata> = {
  'home-hero': landscape,
  'guides-header': stillLife,
  'regions-header': woodland,
  'about-header': flowers,
  ...Object.fromEntries(Object.entries(uniqueImages).map(([path, module]) => [path.split('/').at(-1)!.replace(/\.webp$/, ''), module.default])),
};

export const getEditorialImage = (kind: EditorialKind): ImageMetadata => {
  const image = editorialImages[kind];
  if (!image) throw new Error(`Missing dedicated editorial image: ${kind}`);
  return image;
};

const positions: Partial<Record<EditorialKind, string>> = {
  'guide-estimate-checklist-header': '50% 20%',
  'guide-choose-funeral-company-header': '50% 12%',
  'guide-funeral-etiquette-header': '50% 40%',
};
export const editorialPosition = (kind: EditorialKind): string => positions[kind] ?? 'center';

export const articleVisual = (slug: string): EditorialKind => `guide-${slug}-header`;
export const interludeVisual = (slug: string): EditorialKind => `guide-${slug}-interlude`;
export const regionVisual = (slug: string, placement: 'header' | 'interlude' = 'header'): EditorialKind => `region-${slug}-${placement}`;
