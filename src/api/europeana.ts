import { MuseumRug } from '../types';
import { isLikelyRug } from './rug-filter';

export async function fetchEuropeanaRugs(): Promise<MuseumRug[]> {
  try {
    // Run all queries in parallel using server-side proxy
    const queries = ['carpet', 'rug', 'kilim'];
    const seenIds = new Set<string>();
    const rugs: MuseumRug[] = [];

    console.log('[Europeana Client] Starting fetch...');
    const results = await Promise.allSettled(
      queries.map((q) =>
        fetch(`/api/europeana-fetch?q=${encodeURIComponent(q)}&rows=50`).then((r) => {
          console.log(`[Europeana Client] Response for "${q}": ${r.status}`);
          return r.json();
        })
      )
    );

    console.log('[Europeana Client] Got results:', results.length);
    for (const result of results) {
      if (result.status !== 'fulfilled') {
        console.log('[Europeana Client] Rejected:', result.reason);
        continue;
      }
      const data = result.value;
      console.log('[Europeana Client] Data:', data.items?.length || 0, 'items, error:', data.error);
      if (!data.items) continue;

      for (const item of data.items) {
        const id = item.id || '';
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        const imageUrl =
          item.edmIsShownBy?.[0] || item.edmPreview?.[0] || '';
        if (!imageUrl) continue;

        const title = item.title?.[0] || 'Untitled';
        const medium = item.dcType?.join(', ') || '';

        if (!isLikelyRug(title, medium, '')) continue;

        const placeParts: string[] = [];
        if (item.edmPlaceLabelLangAware?.en) {
          placeParts.push(...item.edmPlaceLabelLangAware.en);
        } else if (item.edmPlaceLabel) {
          for (const label of item.edmPlaceLabel) {
            if (typeof label === 'string') {
              placeParts.push(label);
            } else if (label?.def) {
              placeParts.push(
                ...(Array.isArray(label.def)
                  ? label.def
                  : [label.def])
              );
            }
          }
        }
        if (!placeParts.length && item.dcCoverage) {
          placeParts.push(...item.dcCoverage);
        }
        const place = placeParts.join(', ');
        if (!place) continue;

        rugs.push({
          id: `europeana-${id}`,
          source: 'europeana',
          title,
          imageUrl,
          date: item.year?.[0]?.toString() || '',
          medium,
          dimensions: '',
          culture: '',
          provenance: place,
          creditLine: item.dataProvider?.[0] || '',
          museumUrl:
            item.edmIsShownAt?.[0] || item.guid || '',
          artist: item.dcCreator?.join(', ') || '',
          description: item.dcDescription?.join(', ') || '',
        });

        if (rugs.length >= 30) return rugs;
      }
    }

    return rugs;
  } catch (err) {
    console.warn('Europeana API error:', err);
    return [];
  }
}
