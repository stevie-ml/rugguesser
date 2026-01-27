import { MuseumRug } from '../types';
import { isLikelyRug } from './rug-filter';

const BASE = 'https://api.vam.ac.uk/v2';

export async function fetchVaRugs(): Promise<MuseumRug[]> {
  try {
    // Use random pages so we get different results each game
    const queries = ['carpet', 'rug', 'kilim'];
    const seenIds = new Set<string>();
    const rugs: MuseumRug[] = [];

    const results = await Promise.allSettled(
      queries.map((q) => {
        const page = Math.floor(Math.random() * 5) + 1;
        return fetch(
          `${BASE}/objects/search?q=${q}&images_exist=true&page_size=45&page=${page}`
        ).then((r) => r.json());
      })
    );

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const data = result.value;
      if (!data.records) continue;

      for (const item of data.records) {
        if (seenIds.has(item.systemNumber)) continue;
        seenIds.add(item.systemNumber);

        const imageId = item._primaryImageId;
        if (!imageId) continue;

        const title = item._primaryTitle || '';
        const objectType = item._objectType || '';
        if (!isLikelyRug(title, '', objectType)) continue;

        const provenance = item._primaryPlace || '';
        if (!provenance) continue;

        const imageUrl = `https://framemark.vam.ac.uk/collections/${imageId}/full/800,/0/default.jpg`;

        rugs.push({
          id: `va-${item.systemNumber}`,
          source: 'va',
          title: title || 'Untitled',
          imageUrl,
          date: item._primaryDate || '',
          medium: objectType,
          dimensions: '',
          culture: '',
          provenance,
          creditLine: '',
          museumUrl: `https://collections.vam.ac.uk/item/${item.systemNumber}`,
          artist: item._primaryMaker?.name || '',
          description: objectType,
        });

        if (rugs.length >= 30) return rugs;
      }
    }

    return rugs;
  } catch (err) {
    console.warn('V&A API error:', err);
    return [];
  }
}
