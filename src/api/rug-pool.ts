import { MuseumRug, ValidatedRug } from '../types';
import { fetchMetRugs } from './met';
import { fetchClevelandRugs } from './cleveland';
import { fetchAicRugs } from './aic';
import { fetchSmithsonianRugs } from './smithsonian';
import { fetchEuropeanaRugs } from './europeana';
import { fetchVaRugs } from './va';
import { fetchDplaRugs } from './dpla';
import { fetchWikidataRugs } from './wikidata';
import { validateProvenances } from './provenance';
import { isNewWorldRug } from './locations';

/** Maximum number of New World rugs allowed per game */
const MAX_NEW_WORLD = 1;
/** Probability that any New World rug is included at all (0–1) */
const NEW_WORLD_INCLUSION_PROB = 0.3;
/** Cap per source when assembling the combined pool for balance */
const MAX_PER_SOURCE = 15;

export async function buildRugPool(
  onProgress: (msg: string) => void
): Promise<ValidatedRug[]> {
  onProgress('Searching museum collections for rugs...');

  // Fetch from all 8 sources in parallel — each source already caps at 30
  const [met, cleveland, aic, smithsonian, europeana, va, dpla, wikidata] =
    await Promise.allSettled([
      fetchMetRugs().then((r) => {
        onProgress(`The Met: found ${r.length} rugs`);
        return r;
      }),
      fetchClevelandRugs().then((r) => {
        onProgress(`Cleveland Museum: found ${r.length} rugs`);
        return r;
      }),
      fetchAicRugs().then((r) => {
        onProgress(`Art Institute of Chicago: found ${r.length} rugs`);
        return r;
      }),
      fetchSmithsonianRugs().then((r) => {
        onProgress(`Smithsonian: found ${r.length} rugs`);
        return r;
      }),
      fetchEuropeanaRugs().then((r) => {
        onProgress(`Europeana: found ${r.length} rugs`);
        return r;
      }),
      fetchVaRugs().then((r) => {
        onProgress(`Victoria & Albert: found ${r.length} rugs`);
        return r;
      }),
      fetchDplaRugs().then((r) => {
        onProgress(`DPLA: found ${r.length} rugs`);
        return r;
      }),
      fetchWikidataRugs().then((r) => {
        onProgress(`Wikidata/Commons: found ${r.length} rugs`);
        return r;
      }),
    ]);

  // Extract results, shuffle each source, and cap per source for balance
  const cap = (r: PromiseSettledResult<MuseumRug[]>) =>
    r.status === 'fulfilled' ? shuffle(r.value).slice(0, MAX_PER_SOURCE) : [];

  // Separate Wikidata (pre-validated coordinates) from others
  const wikidataRugs = cap(wikidata);
  const otherRugs: MuseumRug[] = [
    ...cap(met),
    ...cap(cleveland),
    ...cap(aic),
    ...cap(smithsonian),
    ...cap(europeana),
    ...cap(va),
    ...cap(dpla),
  ];

  const totalRaw = otherRugs.length + wikidataRugs.length;
  onProgress(
    `Total: ${totalRaw} rugs (balanced). Validating provenance...`
  );

  // Validate non-Wikidata rugs — use heuristic first (fast), LLM only if needed
  const validated: ValidatedRug[] = [];

  // Send all at once to provenance validator (which batches internally if using LLM)
  const batchSize = 50;
  for (let i = 0; i < otherRugs.length; i += batchSize) {
    const batch = otherRugs.slice(i, i + batchSize);
    const results = await validateProvenances(batch);
    validated.push(...results);
    onProgress(
      `Validated ${Math.min(i + batchSize, otherRugs.length)}/${otherRugs.length} — ${validated.length} valid`
    );
  }

  // Wikidata rugs already have validated coordinates from SPARQL
  for (const rug of wikidataRugs) {
    const wd = rug as MuseumRug & {
      _wikidataLat?: number;
      _wikidataLng?: number;
    };
    if (wd._wikidataLat != null && wd._wikidataLng != null) {
      validated.push({
        ...rug,
        location: {
          name: rug.provenance,
          lat: wd._wikidataLat,
          lng: wd._wikidataLng,
        },
      });
    }
  }

  onProgress(`Pool ready: ${validated.length} rugs with specific origins`);

  // Deduplicate by title
  const seen = new Set<string>();
  const deduped = validated.filter((r) => {
    const key = r.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Apply New World depression
  const oldWorld = deduped.filter((r) => !isNewWorldRug(r));
  const newWorld = deduped.filter((r) => isNewWorldRug(r));

  const shuffledOld = shuffle(oldWorld);
  const shuffledNew = shuffle(newWorld);

  let newWorldCount = 0;
  if (shuffledNew.length > 0 && Math.random() < NEW_WORLD_INCLUSION_PROB) {
    newWorldCount = Math.min(MAX_NEW_WORLD, shuffledNew.length);
  }

  const finalPool = [...shuffledOld];
  if (newWorldCount > 0) {
    for (let i = 0; i < newWorldCount; i++) {
      const pos = Math.floor(Math.random() * (finalPool.length + 1));
      finalPool.splice(pos, 0, shuffledNew[i]);
    }
  }

  return finalPool;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
