import { MuseumRug } from '../types';
import { isLikelyRug } from './rug-filter';

export async function fetchSmithsonianRugs(): Promise<MuseumRug[]> {
  // Use provided key, or fall back to the public DEMO_KEY (rate-limited)
  const apiKey =
    import.meta.env.VITE_SMITHSONIAN_API_KEY || 'DEMO_KEY';

  try {
    const queries = ['carpet', 'rug', 'kilim'];
    const seenIds = new Set<string>();
    const rugs: MuseumRug[] = [];

    for (const q of queries) {
      try {
        const res = await fetch(
          `https://api.si.edu/openaccess/api/v1.0/search?q=${q}&api_key=${apiKey}&rows=50`
        );
        if (!res.ok) continue;
        const data = await res.json();
        if (!data.response?.rows) continue;

        for (const row of data.response.rows) {
          if (seenIds.has(row.id)) continue;
          seenIds.add(row.id);

          const content = row.content;
          if (!content) continue;

          const descriptive = content.descriptiveNonRepeating;
          const freetext = content.freetext;

          // Extract image
          const media = descriptive?.online_media?.media;
          const imageUrl =
            media?.[0]?.content || media?.[0]?.thumbnail || '';
          if (!imageUrl) continue;

          // Extract title
          const title =
            descriptive?.title?.content || content.title || 'Untitled';

          // Filter to rugs only
          const physDesc =
            freetext?.physicalDescription
              ?.map((p: any) => p.content)
              .join(', ') || '';
          const objectType =
            content.indexedStructured?.object_type?.join(', ') || '';
          if (!isLikelyRug(title, physDesc, objectType)) continue;

          // Extract place info
          const place =
            freetext?.place
              ?.map((p: any) => p.content)
              .join(', ') ||
            content.indexedStructured?.place?.join(', ') ||
            '';
          if (!place) continue;

          rugs.push({
            id: `smithsonian-${row.id}`,
            source: 'smithsonian',
            title,
            imageUrl,
            date:
              freetext?.date
                ?.map((d: any) => d.content)
                .join(', ') || '',
            medium: physDesc,
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
              freetext?.name
                ?.map((n: any) => n.content)
                .join(', ') || '',
            description:
              freetext?.notes
                ?.map((n: any) => n.content)
                .join(', ') || '',
          });
        }
      } catch {
        // Individual query failures are OK (e.g., DEMO_KEY rate limit)
      }
    }

    return rugs;
  } catch (err) {
    console.warn('Smithsonian API error:', err);
    return [];
  }
}
