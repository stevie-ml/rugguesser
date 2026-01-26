import { MuseumRug } from '../types';

export async function fetchEuropeanaRugs(): Promise<MuseumRug[]> {
  const apiKey = import.meta.env.VITE_EUROPEANA_API_KEY;
  if (!apiKey) {
    console.info('Europeana API key not set, skipping');
    return [];
  }

  try {
    const res = await fetch(
      `https://api.europeana.eu/record/v2/search.json?query=carpet+rug&media=true&rows=50&wskey=${apiKey}`
    );
    if (!res.ok) return [];
    const data = await res.json();

    if (!data.items) return [];

    const rugs: MuseumRug[] = [];

    for (const item of data.items) {
      const imageUrl =
        item.edmIsShownBy?.[0] || item.edmPreview?.[0] || '';
      if (!imageUrl) continue;

      // Extract place from various fields
      const placeParts: string[] = [];
      if (item.edmPlaceLabelLangAware?.en) {
        placeParts.push(...item.edmPlaceLabelLangAware.en);
      } else if (item.edmPlaceLabel) {
        for (const label of item.edmPlaceLabel) {
          if (typeof label === 'string') {
            placeParts.push(label);
          } else if (label?.def) {
            placeParts.push(
              ...(Array.isArray(label.def) ? label.def : [label.def])
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
        id: `europeana-${item.id}`,
        source: 'europeana',
        title: item.title?.[0] || 'Untitled',
        imageUrl,
        date: item.year?.[0]?.toString() || '',
        medium: item.dcType?.join(', ') || '',
        dimensions: '',
        culture: '',
        provenance: place,
        creditLine: item.dataProvider?.[0] || '',
        museumUrl: item.edmIsShownAt?.[0] || item.guid || '',
        artist: item.dcCreator?.join(', ') || '',
        description: item.dcDescription?.join(', ') || '',
      });
    }

    return rugs;
  } catch (err) {
    console.warn('Europeana API error:', err);
    return [];
  }
}
