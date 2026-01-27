import { MuseumRug } from '../types';
import { isLikelyRug } from './rug-filter';

const BASE = 'https://openaccess-api.clevelandart.org/api';

export async function fetchClevelandRugs(): Promise<MuseumRug[]> {
  try {
    // Multiple searches to maximize coverage
    const queries = ['carpet', 'rug', 'kilim', 'textile weaving'];
    const seenIds = new Set<number>();
    const rugs: MuseumRug[] = [];

    for (const q of queries) {
      try {
        const res = await fetch(
          `${BASE}/artworks/?q=${q}&has_image=1&limit=100`
        );
        if (!res.ok) continue;
        const data = await res.json();
        if (!data.data) continue;

        for (const item of data.data) {
          if (seenIds.has(item.id)) continue;
          seenIds.add(item.id);

          const imageUrl = item.images?.web?.url;
          if (!imageUrl) continue;

          // Filter to actual rugs only
          if (
            !isLikelyRug(
              item.title || '',
              item.technique || '',
              item.type || ''
            )
          )
            continue;

          const cultureStr = Array.isArray(item.culture)
            ? item.culture.join(', ')
            : item.culture || '';
          const provenance =
            item.find_spot || item.creation_place || cultureStr;
          if (!provenance) continue;

          rugs.push({
            id: `cleveland-${item.id}`,
            source: 'cleveland',
            title: item.title || 'Untitled',
            imageUrl,
            date: item.creation_date || '',
            medium: item.technique || '',
            dimensions: item.measurements || '',
            culture: cultureStr,
            provenance,
            creditLine: item.creditline || '',
            museumUrl:
              item.url ||
              `https://www.clevelandart.org/art/${item.id}`,
            artist:
              item.creators
                ?.map((c: any) => c.description)
                .join(', ') || '',
            description: item.description || item.fun_fact || '',
          });
        }
      } catch {
        // Individual query failures are OK
      }
    }

    return rugs;
  } catch (err) {
    console.warn('Cleveland API error:', err);
    return [];
  }
}
