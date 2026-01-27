import { MuseumRug } from '../types';
import { isLikelyRug } from './rug-filter';

export async function fetchEuropeanaRugs(): Promise<MuseumRug[]> {
  const apiKey = import.meta.env.VITE_EUROPEANA_API_KEY;
  if (!apiKey) {
    console.info('Europeana API key not set, skipping');
    return [];
  }

  try {
    const queries = ['carpet', 'rug', 'kilim'];
    const seenIds = new Set<string>();
    const rugs: MuseumRug[] = [];

    for (const q of queries) {
      try {
        const res = await fetch(
          `https://api.europeana.eu/record/v2/search.json?query=${q}&media=true&rows=50&wskey=${apiKey}`
        );
        if (!res.ok) continue;
        const data = await res.json();
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

          // Filter to actual rugs only
          if (!isLikelyRug(title, medium, '')) continue;

          // Extract place
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
        }
      } catch {
        // Individual query failures are OK
      }
    }

    return rugs;
  } catch (err) {
    console.warn('Europeana API error:', err);
    return [];
  }
}
