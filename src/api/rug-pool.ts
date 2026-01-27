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

export async function buildRugPool(
  onProgress: (msg: string) => void
): Promise<ValidatedRug[]> {
  onProgress('Searching museum collections for rugs...');

  // Fetch from all 8 sources in parallel
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

  // Separate Wikidata rugs (already have coordinates) from others
  const wikidataRugs: MuseumRug[] =
    wikidata.status === 'fulfilled' ? wikidata.value : [];

  const otherRugs: MuseumRug[] = [
    ...(met.status === 'fulfilled' ? met.value : []),
    ...(cleveland.status === 'fulfilled' ? cleveland.value : []),
    ...(aic.status === 'fulfilled' ? aic.value : []),
    ...(smithsonian.status === 'fulfilled' ? smithsonian.value : []),
    ...(europeana.status === 'fulfilled' ? europeana.value : []),
    ...(va.status === 'fulfilled' ? va.value : []),
    ...(dpla.status === 'fulfilled' ? dpla.value : []),
  ];

  onProgress(
    `Total: ${otherRugs.length + wikidataRugs.length} rugs found. Checking provenance specificity...`
  );

  // Validate non-Wikidata rugs in batches
  const batchSize = 25;
  const validated: ValidatedRug[] = [];

  for (let i = 0; i < otherRugs.length; i += batchSize) {
    const batch = otherRugs.slice(i, i + batchSize);
    const results = await validateProvenances(batch);
    validated.push(...results);
    onProgress(
      `Checked ${Math.min(i + batchSize, otherRugs.length)}/${otherRugs.length} — ${validated.length} valid so far`
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

  // Apply New World depression: separate into Old World and New World pools
  const oldWorld = deduped.filter((r) => !isNewWorldRug(r));
  const newWorld = deduped.filter((r) => isNewWorldRug(r));

  // Shuffle both pools
  const shuffledOld = shuffle(oldWorld);
  const shuffledNew = shuffle(newWorld);

  // Decide how many New World rugs to include (0 or 1, probabilistic)
  let newWorldCount = 0;
  if (shuffledNew.length > 0 && Math.random() < NEW_WORLD_INCLUSION_PROB) {
    newWorldCount = Math.min(MAX_NEW_WORLD, shuffledNew.length);
  }

  // Build final pool: mostly Old World with at most 1 New World rug
  const finalPool = [...shuffledOld];
  if (newWorldCount > 0) {
    // Insert New World rug(s) at random positions
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
