/**
 * Determines whether a museum object is actually a rug, carpet, or kilim
 * (as opposed to metalwork, ceramics, etc. that merely reference carpet motifs).
 */

const RUG_POSITIVE =
  /\b(carpet|rug|kilim|kelim|flatweave|flat[\s-]weave|dhurrie|durrie|soumak|sumak|sumakh|verneh|cicim|tapestry|yastik|prayer\s+rug|runner|wagireh|pile\s+weav|floor\s+cover)\b/i;

const TEXTILE_WITH_FIBER =
  /\b(textile|woven|weaving|knotted)\b/i;

const FIBER_TERMS =
  /\b(wool|silk|cotton|jute|hemp)\b/i;

const EXCLUDE_OBJECTS =
  /\b(mirror|sword|dagger|blade|helmet|shield|bowl|vase|plate|dish|cup|bottle|jug|jar|tile[sd]?\b|coin|medal|brooch|ring|necklace|bracelet|earring|pendant|sculpture|statue|bust|figurin|painting|drawing|print|photograph|book|manuscript|furniture|chair|table|cabinet|chest|clock|watch|lamp|candlestick|chandelier|garment|dress|robe|coat|shirt|hat|shoe|boot|pillow|cushion|bag\b|saddlebag|curtain|cover(?!ing)|panel\b|border\b|fragment of a border)\b/i;

export function isLikelyRug(
  title: string,
  medium: string,
  classification: string,
  objectName?: string
): boolean {
  const titleLower = title.toLowerCase();
  const allText = `${title} ${medium} ${classification} ${objectName || ''}`;

  // Strong exclusion: if the title itself names a non-rug object, reject
  if (EXCLUDE_OBJECTS.test(titleLower)) {
    // But allow if title ALSO explicitly says carpet/rug/kilim
    const titleHasRug = /\b(carpet|rug|kilim)\b/i.test(titleLower);
    if (!titleHasRug) return false;
  }

  // Direct match: any field mentions rug/carpet/kilim
  if (RUG_POSITIVE.test(allText)) return true;

  // Indirect match: classified as textile AND made of fiber materials
  if (TEXTILE_WITH_FIBER.test(classification) && FIBER_TERMS.test(medium))
    return true;

  // Object name match (Met API provides this)
  if (objectName && /\b(carpet|rug|kilim)\b/i.test(objectName)) return true;

  return false;
}
