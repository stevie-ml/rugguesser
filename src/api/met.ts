import { MuseumRug } from '../types';

const BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';

export async function fetchMetRugs(): Promise<MuseumRug[]> {
  try {
    const searchRes = await fetch(
      `${BASE}/search?q=carpet+rug&hasImages=true`
    );
    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();

    if (!searchData.objectIDs?.length) return [];

    // Random subset to keep request count reasonable
    const ids = shuffle(searchData.objectIDs).slice(0, 60);

    const rugs: MuseumRug[] = [];
    const batchSize = 10;

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((id) =>
          fetch(`${BASE}/objects/${id}`).then((r) => r.json())
        )
      );

      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        const obj = result.value;
        if (!obj.primaryImage) continue;

        // Build provenance string from geography fields
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
