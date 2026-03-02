import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'http';
import { resolve } from 'path';

async function readBody(req: IncomingMessage): Promise<string> {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }
  return body;
}

async function callClaude(
  apiKey: string,
  prompt: string,
  maxTokens = 4096
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'api-middleware',
        configureServer(server) {
          // DPLA server-side proxy — avoids CORS
          server.middlewares.use(
            '/api/dpla-fetch',
            async (req: IncomingMessage, res: ServerResponse) => {
              const reqUrl = new URL(req.url || '/', 'http://localhost');
              const q = reqUrl.searchParams.get('q') || 'carpet';
              const pageSize = reqUrl.searchParams.get('page_size') || '50';
              const page = reqUrl.searchParams.get('page') || '1';
              const apiKey =
                env.VITE_DPLA_API_KEY || '';

              if (!apiKey) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ docs: [], error: 'No DPLA API key' }));
                return;
              }

              try {
                const dplaUrl = `https://api.dp.la/v2/items?q=${encodeURIComponent(q)}&page_size=${pageSize}&page=${page}&api_key=${apiKey}`;
                console.log(`[DPLA] Fetching: ${dplaUrl.replace(apiKey, 'KEY')}`);
                const response = await fetch(dplaUrl);
                if (!response.ok) {
                  const errText = await response.text();
                  console.error(`[DPLA] Error ${response.status}: ${errText}`);
                  res.setHeader('Content-Type', 'application/json');
                  res.end(
                    JSON.stringify({
                      docs: [],
                      error: `DPLA API ${response.status}`,
                    })
                  );
                  return;
                }
                const data = await response.json();
                console.log(
                  `[DPLA] Got ${data.docs?.length || 0} docs for "${q}"`
                );
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
              } catch (err: any) {
                console.error('[DPLA] Fetch error:', err.message);
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({ docs: [], error: err.message })
                );
              }
            }
          );

          // Smithsonian server-side proxy — avoids CORS
          server.middlewares.use(
            '/api/smithsonian-fetch',
            async (req: IncomingMessage, res: ServerResponse) => {
              const reqUrl = new URL(req.url || '/', 'http://localhost');
              const q = reqUrl.searchParams.get('q') || 'carpet';
              const rows = reqUrl.searchParams.get('rows') || '40';
              const apiKey =
                env.VITE_SMITHSONIAN_API_KEY || '';

              if (!apiKey) {
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    response: { rows: [] },
                    error: 'No Smithsonian API key',
                  })
                );
                return;
              }

              try {
                const siUrl = `https://api.si.edu/openaccess/api/v1.0/search?q=${encodeURIComponent(q)}&api_key=${apiKey}&rows=${rows}`;
                console.log(
                  `[Smithsonian] Fetching: ${siUrl.replace(apiKey, 'KEY')}`
                );
                const response = await fetch(siUrl);
                if (!response.ok) {
                  const errText = await response.text();
                  console.error(
                    `[Smithsonian] Error ${response.status}: ${errText}`
                  );
                  res.setHeader('Content-Type', 'application/json');
                  res.end(
                    JSON.stringify({
                      response: { rows: [] },
                      error: `Smithsonian API ${response.status}`,
                    })
                  );
                  return;
                }
                const data = await response.json();
                console.log(
                  `[Smithsonian] Got ${data.response?.rows?.length || 0} rows for "${q}"`
                );
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
              } catch (err: any) {
                console.error('[Smithsonian] Fetch error:', err.message);
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    response: { rows: [] },
                    error: err.message,
                  })
                );
              }
            }
          );

          // Provenance validation endpoint
          server.middlewares.use(
            '/api/check-provenance',
            async (req: IncomingMessage, res: ServerResponse) => {
              if (req.method !== 'POST') {
                res.statusCode = 405;
                res.end(JSON.stringify({ error: 'Method not allowed' }));
                return;
              }

              const body = await readBody(req);

              let items: { provenance: string; title: string }[];
              try {
                const parsed = JSON.parse(body);
                if (parsed.items) {
                  items = parsed.items;
                } else if (parsed.provenances) {
                  items = parsed.provenances.map((p: string) => ({
                    provenance: p,
                    title: '',
                  }));
                } else {
                  throw new Error('Missing items or provenances');
                }
              } catch {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid JSON body' }));
                return;
              }

              const apiKey = env.ANTHROPIC_API_KEY;
              if (!apiKey) {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 503;
                res.end(
                  JSON.stringify({
                    error:
                      'ANTHROPIC_API_KEY not set — using fallback heuristic',
                  })
                );
                return;
              }

              try {
                const prompt = `You are helping validate items for a rug-guessing geography game. For each item below, determine TWO things:

1. Is it actually a rug, carpet, or kilim? Check the title — if it describes something that is NOT a rug/carpet/kilim (e.g., a cap, hat, mirror, garment, bowl, tapestry panel, textile fragment, embroidery, shawl, silk cap, silk hat, painting, portrait, still life, photograph, etc.), mark isRug as false. Only actual rugs, carpets, kilims, and flatweaves are acceptable.

2. Is the provenance specific enough for a geography game? A specific city, town, district, or well-defined small region is GOOD (e.g., "Tabriz", "Isfahan", "Shirvan", "Kashan", "Hereke", "Oushak", "Agra", "Kuba", "Konya", "Bergama"). Reject: countries/regions ("Turkey", "Iran", "Persia", "Caucasus", "Central Asia", "Middle East", "India", "China", "Anatolia", "Egypt"), vague terms ("probably Turkish", "possibly Persian"), AND ethnic/tribal group names ("Kazak", "Turkmen", "Qashqai", "Bakhtiari", "Afshar", "Baluch", "Yomut", "Tekke", "Shahsavan", "Kurdish", "Lori", "Talish", "Dagestan"). Tribal names span large regions and are NOT specific locations.

If both isRug AND specific are true, provide the place name and coordinates.

Items:
${items.map((item, i: number) => `${i}: title="${item.title}" provenance="${item.provenance}"`).join('\n')}

Respond ONLY with a valid JSON array (no markdown, no explanation). Each element must be:
{"index": <number>, "isRug": <boolean>, "specific": <boolean>, "placeName": "<name>" | null, "lat": <number> | null, "lng": <number> | null}`;

                const text = await callClaude(apiKey, prompt);
                res.setHeader('Content-Type', 'application/json');

                const jsonMatch = text.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                  res.end(
                    JSON.stringify({
                      results: JSON.parse(jsonMatch[0]),
                    })
                  );
                } else {
                  res.end(
                    JSON.stringify({
                      error: 'Could not parse LLM response',
                      raw: text,
                    })
                  );
                }
              } catch (err: any) {
                console.error('LLM provenance error:', err);
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
              }
            }
          );

          // Final rug verification endpoint
          server.middlewares.use(
            '/api/verify-rugs',
            async (req: IncomingMessage, res: ServerResponse) => {
              if (req.method !== 'POST') {
                res.statusCode = 405;
                res.end(JSON.stringify({ error: 'Method not allowed' }));
                return;
              }

              const body = await readBody(req);

              let titles: string[];
              try {
                const parsed = JSON.parse(body);
                titles = parsed.titles;
                if (!Array.isArray(titles)) throw new Error('Missing titles');
              } catch {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid JSON body' }));
                return;
              }

              const apiKey = env.ANTHROPIC_API_KEY;
              if (!apiKey) {
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    results: titles.map((_: string, i: number) => ({
                      index: i,
                      isRug: true,
                    })),
                  })
                );
                return;
              }

              try {
                const prompt = `You are a rug expert verifying items for a rug-guessing game. For each item title below, determine if it is ACTUALLY a rug, carpet, kilim, or flatweave.

REJECT anything that is NOT a rug/carpet/kilim/flatweave, including:
- Paintings, portraits, still lifes, drawings, prints, photographs
- Caps, hats, headwear, clothing, garments
- Tapestries, tapestry panels, wall hangings
- Textile fragments, silk panels, embroideries
- Bags, saddlebags, pouches
- Pillows, cushions, blankets
- Bowls, tiles, jewelry, furniture
- Any non-floor-covering textile

ACCEPT: Rugs, carpets, kilims, flatweaves, prayer rugs, runners, floor coverings.

Items:
${titles.map((t: string, i: number) => `${i}: "${t}"`).join('\n')}

Respond ONLY with a valid JSON array (no markdown, no explanation). Each element:
{"index": <number>, "isRug": <boolean>}`;

                const text = await callClaude(apiKey, prompt, 1024);
                res.setHeader('Content-Type', 'application/json');

                const jsonMatch = text.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                  res.end(
                    JSON.stringify({ results: JSON.parse(jsonMatch[0]) })
                  );
                } else {
                  res.end(
                    JSON.stringify({
                      results: titles.map((_: string, i: number) => ({
                        index: i,
                        isRug: true,
                      })),
                    })
                  );
                }
              } catch (err: any) {
                console.error('LLM verify error:', err);
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    results: titles.map((_: string, i: number) => ({
                      index: i,
                      isRug: true,
                    })),
                  })
                );
              }
            }
          );
        },
      },
    ],
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          debug: resolve(__dirname, 'debug.html'),
        },
      },
    },
  };
});
