import { MuseumRug } from '../types';

const BASE = 'https://openaccess-api.clevelandart.org/api';

export async function fetchClevelandRugs(): Promise<MuseumRug[]> {
  try {
    // Search for rugs and carpets with images
    const res = await fetch(
      `${BASE}/artworks/?q=rug+carpet&has_image=1&limit=100`
    );
    if (!res.ok) return [];
    const data = await res.json();

    if (!data.data) return [];

    const rugs: MuseumRug[] = [];

    for (const item of data.data) {
      const imageUrl = item.images?.web?.url;
      if (!imageUrl) continue;

      // Try to build provenance from multiple fields
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
        museumUrl: item.url || `https://www.clevelandart.org/art/${item.id}`,
        artist:
          item.creators?.map((c: any) => c.description).join(', ') ||
          '',
        description: item.description || item.fun_fact || '',
      });
    }

    return rugs;
  } catch (err) {
    console.warn('Cleveland API error:', err);
    return [];
  }
}
