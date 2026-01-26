import { MuseumRug, ValidatedRug } from '../types';
import { KNOWN_LOCATIONS, BROAD_TERMS } from './locations';

/**
 * Validate provenance strings: try LLM first, fall back to heuristic matching.
 * Returns only rugs with specific-enough origins and valid coordinates.
 */
export async function validateProvenances(
  rugs: MuseumRug[]
): Promise<ValidatedRug[]> {
  if (rugs.length === 0) return [];

  const provenances = rugs.map((r) => r.provenance);

  // Try LLM-based validation first
  try {
    const res = await fetch('/api/check-provenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provenances }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.results && Array.isArray(data.results)) {
        const validated: ValidatedRug[] = [];
        for (const r of data.results) {
          if (
            r.specific &&
            r.lat != null &&
            r.lng != null &&
            r.index >= 0 &&
            r.index < rugs.length
          ) {
            validated.push({
              ...rugs[r.index],
              location: {
                name: r.placeName || rugs[r.index].provenance,
                lat: r.lat,
                lng: r.lng,
              },
            });
          }
        }
        if (validated.length > 0) return validated;
      }
    }
  } catch (err) {
    console.warn('LLM provenance check unavailable, using fallback:', err);
  }

  // Fallback: heuristic matching against known locations database
  return heuristicValidation(rugs);
}

function heuristicValidation(rugs: MuseumRug[]): ValidatedRug[] {
  const result: ValidatedRug[] = [];

  for (const rug of rugs) {
    const text = rug.provenance.toLowerCase().trim();

    // Skip if provenance is only a broad term
    const textWords = text.split(/[\s,;.()]+/).filter(Boolean);
    const allBroad = textWords.every(
      (w) =>
        BROAD_TERMS.includes(w) ||
        w.length <= 2 ||
        /^\d+$/.test(w)
    );
    if (allBroad && textWords.length > 0) continue;

    // Check if provenance is exactly a broad term
    if (BROAD_TERMS.includes(text)) continue;

    // Try to find a known location in the provenance text
    let matched = false;

    // Check multi-word location names first (longer matches win)
    const locationEntries = Object.entries(KNOWN_LOCATIONS).sort(
      (a, b) => b[0].length - a[0].length
    );

    for (const [key, coords] of locationEntries) {
      if (text.includes(key)) {
        result.push({
          ...rug,
          location: {
            name: capitalize(key),
            ...coords,
          },
        });
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Try individual words from the provenance
      for (const word of textWords) {
        const clean = word.replace(/[^a-z]/g, '');
        if (clean.length < 3) continue;
        if (KNOWN_LOCATIONS[clean]) {
          result.push({
            ...rug,
            location: {
              name: capitalize(clean),
              ...KNOWN_LOCATIONS[clean],
            },
          });
          break;
        }
      }
    }
  }

  return result;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
