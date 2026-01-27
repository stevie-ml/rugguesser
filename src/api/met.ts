import { MuseumRug } from '../types';
import { isLikelyRug } from './rug-filter';

const BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';

export async function fetchMetRugs(): Promise<MuseumRug[]> {
  try {
    // Search with multiple terms to maximize coverage
    const searchTerms = ['carpet', 'rug', 'kilim'];
    const allIds = new Set<number>();

    await Promise.all(
      searchTerms.map(async (term) => {
        try {
          const res = await fetch(
            `${BASE}/search?q=${term}&hasImages=true`
          );
          if (!res.ok) return;
          const data = await res.json();
          if (data.objectIDs) {
            data.objectIDs.forEach((id: number) => allIds.add(id));
          }
        } catch {
          // Individual search failures are OK
        }
      })
    );

    if (allIds.size === 0) return [];

    // Pick a random sample of 100 from the combined IDs
    const idsArray = shuffle([...allIds]).slice(0, 100);

    const rugs: MuseumRug[] = [];
    const batchSize = 10;

    for (let i = 0; i < idsArray.length; i += batchSize) {
      const batch = idsArray.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((id) =>
          fetch(`${BASE}/objects/${id}`).then((r) => r.json())
        )
      );

      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        const obj = result.value;
        if (!obj.primaryImage) continue;

        // Filter: only actual rugs/carpets/kilims
        if (
          !isLikelyRug(
            obj.title || '',
            obj.medium || '',
            obj.classification || '',
            obj.objectName || ''
          )
        )
          continue;

        // Build provenance from geography fields
        const geoFields = [
          obj.city,
          obj.region,
          obj.subregion,
          obj.locale,
          obj.country,
        ].filter(Boolean);
        const provenance =
          geoFields.join(', ') || obj.culture || '';
        if (!provenance) continue;

        rugs.push({
          id: `met-${obj.objectID}`,
          source: 'met',
          title: obj.title || 'Untitled',
          imageUrl: obj.primaryImage,
          date: obj.objectDate || '',
          medium: obj.medium || '',
          dimensions: obj.dimensions || '',
          culture: obj.culture || '',
          provenance,
          creditLine: obj.creditLine || '',
          museumUrl: obj.objectURL || '',
          artist: obj.artistDisplayName || '',
          description: [obj.classification, obj.department]
            .filter(Boolean)
            .join(' — '),
        });
      }
    }

    return rugs;
  } catch (err) {
    console.warn('Met API error:', err);
    return [];
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
