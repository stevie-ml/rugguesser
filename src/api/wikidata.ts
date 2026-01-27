import { MuseumRug } from '../types';
import { isLikelyRug } from './rug-filter';
import { BROAD_TERMS } from './locations';

/**
 * Fetch rugs/carpets from Wikidata + Wikimedia Commons.
 * Uses SPARQL to find items with images and specific geographic origin.
 * This is a supplementary source — use other APIs first when possible.
 */
export async function fetchWikidataRugs(): Promise<MuseumRug[]> {
  // Label-based query: finds more items than strict P31 type matching
  // NOTE: "tapestry" and "silk" removed per user request — only actual rugs/carpets/kilims
  const sparql = `
SELECT DISTINCT ?item ?itemLabel ?image ?origin ?originLabel ?coords ?countryLabel ?inception WHERE {
  ?item rdfs:label ?label .
  FILTER(LANG(?label) = "en")
  FILTER(REGEX(?label, "\\\\b(carpet|rug|kilim|flatweave|prayer rug)\\\\b", "i"))
  ?item wdt:P18 ?image .
  {
    ?item wdt:P1071 ?origin .
  } UNION {
    ?item wdt:P495 ?origin .
  }
  ?origin wdt:P625 ?coords .
  FILTER NOT EXISTS { ?origin wdt:P31 wd:Q6256 . }
  FILTER NOT EXISTS { ?origin wdt:P31 wd:Q3024240 . }
  FILTER NOT EXISTS { ?origin wdt:P31 wd:Q3624078 . }
  FILTER NOT EXISTS { ?origin wdt:P31 wd:Q5 . }
  FILTER NOT EXISTS { ?origin wdt:P31 wd:Q3305213 . }
  FILTER NOT EXISTS { ?origin wdt:P31 wd:Q15334 . }
  FILTER NOT EXISTS { ?origin wdt:P31 wd:Q82794 . }
  FILTER NOT EXISTS { ?origin wdt:P31 wd:Q36784 . }
  OPTIONAL { ?origin wdt:P17 ?country . }
  OPTIONAL { ?item wdt:P571 ?inception . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
}
LIMIT 500
`;

  try {
    const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/sparql-results+json',
        'User-Agent': 'RugGuessr/1.0 (educational game)',
      },
    });

    if (!res.ok) {
      console.warn(`Wikidata SPARQL error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const bindings = data?.results?.bindings;
    if (!Array.isArray(bindings)) return [];

    const seenItems = new Set<string>();
    const rugs: MuseumRug[] = [];

    for (const b of bindings) {
      const itemUri = b.item?.value || '';
      const qid = itemUri.split('/').pop() || '';
      if (!qid || seenItems.has(qid)) continue;
      seenItems.add(qid);

      const title = b.itemLabel?.value || '';
      const image = b.image?.value || '';
      if (!title || !image) continue;

      const originLabel = b.originLabel?.value || '';
      if (!originLabel) continue;

      // Check title against rug filter — skip non-rugs
      if (!isLikelyRug(title, '', '')) continue;

      // Reject broad provenance terms (Anatolia, Caucasus, China, etc.)
      const provLower = originLabel.toLowerCase().trim();
      if (BROAD_TERMS.includes(provLower)) continue;
      const provWords = provLower.split(/[\s,;.()]+/).filter(Boolean);
      const allBroad = provWords.every(
        (w) => BROAD_TERMS.includes(w) || w.length <= 2 || /^\d+$/.test(w)
      );
      if (allBroad && provWords.length > 0) continue;

      // Parse WKT coordinates: Point(longitude latitude)
      const coordStr = b.coords?.value || '';
      const coordMatch = coordStr.match(/Point\(([^ ]+) ([^ ]+)\)/);
      if (!coordMatch) continue;

      const lng = parseFloat(coordMatch[1]);
      const lat = parseFloat(coordMatch[2]);
      if (isNaN(lat) || isNaN(lng)) continue;

      const country = b.countryLabel?.value || '';
      const inception = b.inception?.value || '';
      const dateStr = inception ? inception.substring(0, 4) : '';

      rugs.push({
        id: `wikidata-${qid}`,
        source: 'wikidata',
        title,
        imageUrl: image,
        date: dateStr,
        medium: '',
        dimensions: '',
        culture: country ? `${originLabel}, ${country}` : originLabel,
        provenance: originLabel,
        creditLine: 'Wikimedia Commons',
        museumUrl: `https://www.wikidata.org/wiki/${qid}`,
        artist: '',
        description: '',
        // Wikidata already provides validated coordinates, so we store them
        // for use during provenance validation
        _wikidataLat: lat,
        _wikidataLng: lng,
      } as MuseumRug & { _wikidataLat: number; _wikidataLng: number });
    }

    return rugs;
  } catch (err) {
    console.warn('Wikidata SPARQL error:', err);
    return [];
  }
}
