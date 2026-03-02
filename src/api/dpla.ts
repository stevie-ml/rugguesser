import { MuseumRug } from '../types';
import { isLikelyRug } from './rug-filter';

export async function fetchDplaRugs(): Promise<MuseumRug[]> {
  const queries = ['carpet', 'rug', 'kilim', 'oriental rug'];
  const seenIds = new Set<string>();
  const rugs: MuseumRug[] = [];

  try {
    // Use server-side middleware (/api/dpla-fetch) to avoid CORS
    // API key is read server-side from .env
    console.log('[DPLA Client] Starting fetch...');
    const results = await Promise.allSettled(
      queries.map((q) =>
        fetch(
          `/api/dpla-fetch?q=${encodeURIComponent(q)}&page_size=50`
        ).then((r) => {
          console.log(`[DPLA Client] Response for "${q}": ${r.status}`);
          return r.json();
        })
      )
    );

    console.log('[DPLA Client] Got results:', results.length);
    for (const result of results) {
      if (result.status !== 'fulfilled') {
        console.log('[DPLA Client] Rejected:', result.reason);
        continue;
      }
      const data = result.value;
      console.log('[DPLA Client] Data:', data.docs?.length || 0, 'docs, error:', data.error);
      if (!data.docs || !Array.isArray(data.docs)) continue;

      for (const doc of data.docs) {
        const id = doc.id;
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);

        const sr = doc.sourceResource;
        if (!sr) continue;

        const imageUrl = doc.object || '';
        if (!imageUrl) continue;

        const title = Array.isArray(sr.title)
          ? sr.title.join('; ')
          : sr.title || 'Untitled';

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

        const dimensions = Array.isArray(sr.extent)
          ? sr.extent.join(', ')
          : sr.extent || '';

        const creator = Array.isArray(sr.creator)
          ? sr.creator.join(', ')
          : sr.creator || '';

        const museumUrl = doc.isShownAt || '';
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

        if (rugs.length >= 30) return rugs;
      }
    }

    return rugs;
  } catch (err) {
    console.warn('DPLA API error:', err);
    return [];
  }
}
