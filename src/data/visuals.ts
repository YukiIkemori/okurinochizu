import landscape from '../assets/editorial/landscape.png';
import flowers from '../assets/editorial/flowers.png';
import woodland from '../assets/editorial/woodland.png';
import stillLife from '../assets/editorial/still-life.png';

export const editorialImages = { landscape, flowers, woodland, 'still-life': stillLife };
export type EditorialKind = keyof typeof editorialImages;

export const articleVisual = (category: string): EditorialKind =>
  category === 'cemetery' ? 'woodland' : ['cost', 'planning', 'procedures'].includes(category) ? 'still-life' : 'flowers';

export const interludeVisual = (category: string): EditorialKind =>
  ['cemetery', 'procedures'].includes(category) ? 'landscape' : category === 'cost' ? 'flowers' : 'woodland';

export const regionVisual = (slug: string): EditorialKind =>
  ['karuizawa', 'miyota', 'komoro', 'tateshina'].includes(slug) ? 'woodland' : 'landscape';
