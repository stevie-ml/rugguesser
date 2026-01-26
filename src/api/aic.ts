import { MuseumRug } from '../types';

const BASE = 'https://api.artic.edu/api/v1';

export async function fetchAicRugs(): Promise<MuseumRug[]> {
  try {
    const res = await fetch(
      `${BASE}/artworks/search?q=carpet+rug&fields=id,title,image_id,date_display,artist_display,place_of_origin,medium_display,dimensions,credit_line,classification_title,style_title,description,thumbnail&limit=100`
    );
    if (!res.ok) return [];
    const data = await res.json();

    if (!data.data) return [];

    const rugs: MuseumRug[] = [];

    for (const item of data.data) {
      if (!item.image_id) continue;

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

    return rugs;
  } catch (err) {
    console.warn('AIC API error:', err);
    return [];
  }
}
