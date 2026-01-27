import { MuseumRug } from '../types';
import { isLikelyRug } from './rug-filter';

export async function fetchDplaRugs(): Promise<MuseumRug[]> {
  const apiKey =
    import.meta.env.VITE_DPLA_API_KEY || '';

  if (!apiKey) {
    console.warn('DPLA: no API key set (VITE_DPLA_API_KEY)');
    return [];
  }

  const queries = ['carpet', 'rug', 'kilim', 'oriental rug'];
  const seenIds = new Set<string>();
  const rugs: MuseumRug[] = [];

  for (const q of queries) {
    try {
      const url = `https://api.dp.la/v2/items?q=${encodeURIComponent(q)}&sourceResource.type=image&page_size=100&api_key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.docs || !Array.isArray(data.docs)) continue;

      for (const doc of data.docs) {
        const id = doc.id;
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);

        const sr = doc.sourceResource;
        if (!sr) continue;

        // Need an image
        const imageUrl = doc.object || '';
        if (!imageUrl) continue;

        const title = Array.isArray(sr.title)
          ? sr.title.join('; ')
          : sr.title || 'Untitled';

        // Filter to rugs
        const format = Array.isArray(sr.format)
          ? sr.format.join(', ')
          : sr.format || '';
        const description = Array.isArray(sr.description)
          ? sr.description.join(', ')
          : sr.description || '';
        const subjects = Array.isArray(sr.subject)
          ? sr.subject.map((s: any) => s.name || s).join(', ')
          : '';

        if (!isLikelyRug(title, format, subjects)) continue;

        // Extract spatial/provenance
        let provenance = '';
        if (sr.spatial && Array.isArray(sr.spatial)) {
          const parts: string[] = [];
          for (const sp of sr.spatial) {
            if (sp.name) parts.push(sp.name);
            else if (sp.city) parts.push(sp.city);
            else if (sp.state) parts.push(sp.state);
            else if (sp.country) parts.push(sp.country);
          }
          provenance = parts.join(', ');
        }
        if (!provenance) continue;

        // Date
        let date = '';
        if (sr.date) {
          if (Array.isArray(sr.date)) {
            date = sr.date
              .map((d: any) => d.displayDate || d.begin || '')
              .filter(Boolean)
              .join(', ');
          } else if (typeof sr.date === 'object') {
            date = sr.date.displayDate || sr.date.begin || '';
          } else {
            date = String(sr.date);
          }
        }

        // Dimensions / extent
        const dimensions = Array.isArray(sr.extent)
          ? sr.extent.join(', ')
          : sr.extent || '';

        // Creator
        const creator = Array.isArray(sr.creator)
          ? sr.creator.join(', ')
          : sr.creator || '';

        // Museum link
        const museumUrl = doc.isShownAt || '';

        // Data provider
        const creditLine = doc.dataProvider?.name || doc.dataProvider || '';

        rugs.push({
          id: `dpla-${id}`,
          source: 'dpla',
          title,
          imageUrl,
          date,
          medium: format,
          dimensions,
          culture: subjects,
          provenance,
          creditLine: typeof creditLine === 'string' ? creditLine : '',
          museumUrl,
          artist: creator,
          description,
        });
      }
    } catch (err) {
      console.warn(`DPLA query "${q}" failed:`, err);
    }
  }

  return rugs;
}
