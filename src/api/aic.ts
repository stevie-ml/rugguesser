import { MuseumRug } from '../types';
import { isLikelyRug } from './rug-filter';

const BASE = 'https://api.artic.edu/api/v1';

export async function fetchAicRugs(): Promise<MuseumRug[]> {
  try {
    // Run all queries in parallel for speed
    const queries = ['carpet', 'rug', 'kilim'];
    const seenIds = new Set<number>();
    const rugs: MuseumRug[] = [];

    const results = await Promise.allSettled(
      queries.map((q) =>
        fetch(
          `${BASE}/artworks/search?q=${q}&fields=id,title,image_id,date_display,artist_display,place_of_origin,medium_display,dimensions,credit_line,classification_title,style_title,description,thumbnail&limit=60`
        ).then((r) => r.json())
      )
    );

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const data = result.value;
      if (!data.data) continue;

      for (const item of data.data) {
        if (seenIds.has(item.id)) continue;
        seenIds.add(item.id);

        if (!item.image_id) continue;

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

        if (rugs.length >= 30) return rugs;
      }
    }

    return rugs;
  } catch (err) {
    console.warn('AIC API error:', err);
    return [];
  }
}
