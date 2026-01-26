import { MuseumRug, ValidatedRug } from '../types';
import { fetchMetRugs } from './met';
import { fetchClevelandRugs } from './cleveland';
import { fetchAicRugs } from './aic';
import { fetchSmithsonianRugs } from './smithsonian';
import { fetchEuropeanaRugs } from './europeana';
import { validateProvenances } from './provenance';

export async function buildRugPool(
  onProgress: (msg: string) => void
): Promise<ValidatedRug[]> {
  onProgress('Searching museum collections for rugs...');

  // Fetch from all 5 sources in parallel
  const [met, cleveland, aic, smithsonian, europeana] =
    await Promise.allSettled([
      fetchMetRugs().then((r) => {
        onProgress(`The Met: found ${r.length} candidates`);
        return r;
      }),
      fetchClevelandRugs().then((r) => {
        onProgress(`Cleveland Museum: found ${r.length} candidates`);
        return r;
      }),
      fetchAicRugs().then((r) => {
        onProgress(`Art Institute of Chicago: found ${r.length} candidates`);
        return r;
      }),
      fetchSmithsonianRugs().then((r) => {
        onProgress(`Smithsonian: found ${r.length} candidates`);
        return r;
      }),
      fetchEuropeanaRugs().then((r) => {
        onProgress(`Europeana: found ${r.length} candidates`);
        return r;
      }),
    ]);

  const allRugs: MuseumRug[] = [
    ...(met.status === 'fulfilled' ? met.value : []),
    ...(cleveland.status === 'fulfilled' ? cleveland.value : []),
    ...(aic.status === 'fulfilled' ? aic.value : []),
    ...(smithsonian.status === 'fulfilled' ? smithsonian.value : []),
    ...(europeana.status === 'fulfilled' ? europeana.value : []),
  ];

  onProgress(
    `Total: ${allRugs.length} candidates. Checking provenance specificity...`
  );

  // Validate in batches to avoid overwhelming the LLM
  const batchSize = 25;
  const validated: ValidatedRug[] = [];

  for (let i = 0; i < allRugs.length; i += batchSize) {
    const batch = allRugs.slice(i, i + batchSize);
    const results = await validateProvenances(batch);
    validated.push(...results);
    onProgress(
      `Checked ${Math.min(i + batchSize, allRugs.length)}/${allRugs.length} — ${validated.length} valid so far`
    );
  }

  onProgress(`Pool ready: ${validated.length} rugs with specific origins`);

  // Deduplicate by title (museums sometimes share records)
  const seen = new Set<string>();
  const deduped = validated.filter((r) => {
    const key = r.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return shuffle(deduped);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
