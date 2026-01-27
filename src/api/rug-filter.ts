/**
 * Determines whether a museum object is actually a rug, carpet, or kilim
 * (as opposed to metalwork, ceramics, garments, caps, paintings, etc.).
 */

const RUG_POSITIVE =
  /\b(carpet|rug|kilim|kelim|flatweave|flat[\s-]weave|dhurrie|durrie|soumak|sumak|sumakh|verneh|cicim|yastik|prayer\s+rug|runner|wagireh|pile\s+weav|floor\s+cover)\b/i;

/**
 * Hard-reject: if ANY of these match the title, the item is NEVER a rug,
 * even if "carpet" or "rug" also appears in the title.
 * This catches paintings, prints, photos, etc. that DEPICT or MENTION rugs.
 */
const HARD_REJECT =
  /\b(portrait|still\s+life|painting|oil\s+on|canvas|watercolou?r|gouache|pastel|lithograph|engraving|etching|aquatint|woodcut|wood\s+cut|mezzotint|poster|photograph|photo|fresco|mural|mosaic|miniature(?!\s+rug)|illustration|scene\b|landscape|interior\s+with|view\s+of|depiction|allegory|sculpture|statue|bust|figurin|ceramic|pottery|porcelain)\b/i;

const EXCLUDE_OBJECTS =
  /\b(mirror|sword|dagger|blade|helmet|shield|bowl|vase|plate|dish|cup|bottle|jug|jar|tile[sd]?\b|coin|medal|brooch|ring|necklace|bracelet|earring|pendant|drawing|print|book|manuscript|furniture|chair|table|cabinet|chest|clock|watch|lamp|candlestick|chandelier|garment|dress|robe|coat|shirt|hat|shoe|boot|pillow|cushion|bag\b|saddlebag|curtain|cover(?!ing)|panel\b|border\b|fragment of a border|cap\b|headwear|headdress|head\s*cover|turban|bonnet|skullcap|fez\b|hood\b|cloak|shawl|scarf|belt\b|sash\b|apron|sleeve|collar\b|cuff|glove|mitten|stocking|sock|blanket|bedspread|quilt|towel|napkin|tablecloth|tent\b(?!\s*rug)|canopy|saddle\b|harness|bridle|holster|pouch\b|wallet|purse|tapestry|silk\s+(?:cap|hat|panel|cloth|velvet|brocade|fragment|textile|hanging|banner|embroidery)|dealer|merchant|seller|trader|vendor)\b/i;

export function isLikelyRug(
  title: string,
  medium: string,
  classification: string,
  objectName?: string
): boolean {
  const titleLower = title.toLowerCase();
  const allText = `${title} ${medium} ${classification} ${objectName || ''}`;

  // Hard reject: paintings, portraits, still lifes, etc. — NEVER a rug
  if (HARD_REJECT.test(titleLower)) return false;

  // Strong exclusion: if the title itself names a non-rug object, reject
  if (EXCLUDE_OBJECTS.test(titleLower)) {
    // But allow if title ALSO explicitly says carpet/rug/kilim
    const titleHasRug = /\b(carpet|rug|kilim)\b/i.test(titleLower);
    if (!titleHasRug) return false;
  }

  // Direct match: any field mentions rug/carpet/kilim explicitly
  if (RUG_POSITIVE.test(allText)) return true;

  // Object name match (Met API provides this)
  if (objectName && /\b(carpet|rug|kilim)\b/i.test(objectName)) return true;

  return false;
}
