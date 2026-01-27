import { MuseumRug } from '../types';
import { isLikelyRug } from './rug-filter';

export async function fetchSmithsonianRugs(): Promise<MuseumRug[]> {
  try {
    // Use server-side middleware (/api/smithsonian-fetch) to avoid CORS
    // API key is read server-side from .env
    const queries = ['carpet', 'rug', 'kilim'];
    const seenIds = new Set<string>();
    const rugs: MuseumRug[] = [];

    const results = await Promise.allSettled(
      queries.map((q) =>
        fetch(
          `/api/smithsonian-fetch?q=${encodeURIComponent(q)}&rows=40`
        ).then((r) => r.json())
      )
    );

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const data = result.value;
      if (!data.response?.rows) continue;

      for (const row of data.response.rows) {
        if (seenIds.has(row.id)) continue;
        seenIds.add(row.id);

        const content = row.content;
        if (!content) continue;

        const descriptive = content.descriptiveNonRepeating;
        const freetext = content.freetext;

        const media = descriptive?.online_media?.media;
        const imageUrl =
          media?.[0]?.content || media?.[0]?.thumbnail || '';
        if (!imageUrl) continue;

        const title =
          descriptive?.title?.content || content.title || 'Untitled';

        const physDesc =
          freetext?.physicalDescription
            ?.map((p: any) => p.content)
            .join(', ') || '';
        const objectType =
          content.indexedStructured?.object_type?.join(', ') || '';
        if (!isLikelyRug(title, physDesc, objectType)) continue;

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

        if (rugs.length >= 30) return rugs;
      }
    }

    return rugs;
  } catch (err) {
    console.warn('Smithsonian API error:', err);
    return [];
  }
}
