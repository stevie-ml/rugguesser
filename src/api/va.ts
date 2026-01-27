import { MuseumRug } from '../types';
import { isLikelyRug } from './rug-filter';

const BASE = 'https://api.vam.ac.uk/v2';

export async function fetchVaRugs(): Promise<MuseumRug[]> {
  try {
    // Multiple searches to maximize coverage
    const queries = ['carpet', 'rug', 'kilim'];
    const seenIds = new Set<string>();
    const rugs: MuseumRug[] = [];

    for (const q of queries) {
      try {
        const res = await fetch(
          `${BASE}/objects/search?q=${q}&images_exist=true&page_size=45`
        );
        if (!res.ok) continue;
        const data = await res.json();
        if (!data.records) continue;

        for (const item of data.records) {
          if (seenIds.has(item.systemNumber)) continue;
          seenIds.add(item.systemNumber);

          const imageId = item._primaryImageId;
          if (!imageId) continue;

          // Filter to actual rugs
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
        }
      } catch {
        // Individual query failures are OK; continue with others
      }
    }

    return rugs;
  } catch (err) {
    console.warn('V&A API error:', err);
    return [];
  }
}
