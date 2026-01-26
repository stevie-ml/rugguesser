import { MuseumRug } from '../types';

export async function fetchSmithsonianRugs(): Promise<MuseumRug[]> {
  const apiKey = import.meta.env.VITE_SMITHSONIAN_API_KEY;
  if (!apiKey) {
    console.info('Smithsonian API key not set, skipping');
    return [];
  }

  try {
    const res = await fetch(
      `https://api.si.edu/openaccess/api/v1.0/search?q=rug+carpet+textile&api_key=${apiKey}&rows=50`
    );
    if (!res.ok) return [];
    const data = await res.json();

    if (!data.response?.rows) return [];

    const rugs: MuseumRug[] = [];

    for (const row of data.response.rows) {
      const content = row.content;
      if (!content) continue;

      const descriptive = content.descriptiveNonRepeating;
      const freetext = content.freetext;

      // Extract image
      const media = descriptive?.online_media?.media;
      const imageUrl =
        media?.[0]?.content || media?.[0]?.thumbnail || '';
      if (!imageUrl) continue;

      // Extract place info
      const place =
        freetext?.place?.map((p: any) => p.content).join(', ') ||
        content.indexedStructured?.place?.join(', ') ||
        '';
      if (!place) continue;

      const title =
        descriptive?.title?.content || content.title || 'Untitled';

      rugs.push({
        id: `smithsonian-${row.id}`,
        source: 'smithsonian',
        title,
        imageUrl,
        date:
          freetext?.date?.map((d: any) => d.content).join(', ') ||
          '',
        medium:
          freetext?.physicalDescription
            ?.map((p: any) => p.content)
            .join(', ') || '',
        dimensions:
          freetext?.dimensions
            ?.map((d: any) => d.content)
            .join(', ') || '',
        culture:
          content.indexedStructured?.culture?.join(', ') || '',
        provenance: place,
        creditLine:
          freetext?.creditLine
            ?.map((c: any) => c.content)
            .join(', ') || '',
        museumUrl:
          descriptive?.record_link || descriptive?.guid || '',
        artist:
          freetext?.name?.map((n: any) => n.content).join(', ') ||
          '',
        description:
          freetext?.notes?.map((n: any) => n.content).join(', ') ||
          '',
      });
    }

    return rugs;
  } catch (err) {
    console.warn('Smithsonian API error:', err);
    return [];
  }
}
