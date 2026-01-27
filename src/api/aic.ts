import { MuseumRug } from '../types';
import { isLikelyRug } from './rug-filter';

const BASE = 'https://api.artic.edu/api/v1';

export async function fetchAicRugs(): Promise<MuseumRug[]> {
  try {
    // Multiple searches with different terms
    const queries = ['carpet', 'rug', 'kilim'];
    const seenIds = new Set<number>();
    const rugs: MuseumRug[] = [];

    for (const q of queries) {
      try {
        const res = await fetch(
          `${BASE}/artworks/search?q=${q}&fields=id,title,image_id,date_display,artist_display,place_of_origin,medium_display,dimensions,credit_line,classification_title,style_title,description,thumbnail&limit=100`
        );
        if (!res.ok) continue;
        const data = await res.json();
        if (!data.data) continue;

        for (const item of data.data) {
          if (seenIds.has(item.id)) continue;
          seenIds.add(item.id);

          if (!item.image_id) continue;

          // Filter to actual rugs only
          if (
            !isLikelyRug(
              item.title || '',
              item.medium_display || '',
              item.classification_title || ''
            )
          )
            continue;

          const imageUrl = `https://www.artic.edu/iiif/2/${item.image_id}/full/843,/0/default.jpg`;
          const provenance = item.place_of_origin || '';
          if (!provenance) continue;

          rugs.push({
            id: `aic-${item.id}`,
            source: 'aic',
            title: item.title || 'Untitled',
            imageUrl,
            date: item.date_display || '',
            medium: item.medium_display || '',
            dimensions: item.dimensions || '',
            culture: item.style_title || '',
            provenance,
            creditLine: item.credit_line || '',
            museumUrl: `https://www.artic.edu/artworks/${item.id}`,
            artist: item.artist_display || '',
            description:
              item.description || item.classification_title || '',
          });
        }
      } catch {
        // Individual query failures are OK
      }
    }

    return rugs;
  } catch (err) {
    console.warn('AIC API error:', err);
    return [];
  }
}
