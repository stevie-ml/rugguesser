import { MuseumRug } from '../types';

/**
 * Smithsonian Open Access API - DISABLED
 *
 * The Smithsonian search API does NOT return media/images in search results.
 * To get images, we'd need to fetch each object individually via their
 * IIIF or content endpoints, which is too slow for real-time use.
 *
 * If Smithsonian adds image URLs to search results in the future, this can
 * be re-enabled.
 */
export async function fetchSmithsonianRugs(): Promise<MuseumRug[]> {
  // Disabled — see comment above
  console.info('Smithsonian API disabled (no images in search results)');
  return [];
}
