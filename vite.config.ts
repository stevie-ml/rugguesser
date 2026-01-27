import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'http';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'llm-proxy',
        configureServer(server) {
          server.middlewares.use(
            '/api/check-provenance',
            async (req: IncomingMessage, res: ServerResponse) => {
              if (req.method !== 'POST') {
                res.statusCode = 405;
                res.end(JSON.stringify({ error: 'Method not allowed' }));
                return;
              }

              let body = '';
              for await (const chunk of req) {
                body += chunk;
              }

              let items: { provenance: string; title: string }[];
              try {
                const parsed = JSON.parse(body);
                // Support both old format (provenances array) and new format (items array)
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

1. Is it actually a rug, carpet, or kilim? Check the title — if it describes something that is NOT a rug/carpet/kilim (e.g., a cap, hat, mirror, garment, bowl, tapestry panel, textile fragment, embroidery, shawl, etc.), mark isRug as false. Only actual rugs, carpets, kilims, and flatweaves are acceptable.

2. Is the provenance specific enough for a geography game? A specific city, town, district, or well-defined small region is GOOD (e.g., "Tabriz", "Isfahan", "Shirvan", "Kashan", "Hereke", "Oushak", "Agra", "Kuba", "Konya", "Bergama"). Reject: countries/regions ("Turkey", "Iran", "Persia", "Caucasus", "Central Asia", "Middle East", "India", "China"), vague terms ("probably Turkish", "possibly Persian"), AND ethnic/tribal group names ("Kazak", "Turkmen", "Qashqai", "Bakhtiari", "Afshar", "Baluch", "Yomut", "Tekke", "Shahsavan", "Kurdish", "Lori", "Talish", "Dagestan"). Tribal names span large regions and are NOT specific locations.

If both isRug AND specific are true, provide the place name and coordinates.

Items:
${items.map((item, i: number) => `${i}: title="${item.title}" provenance="${item.provenance}"`).join('\n')}

Respond ONLY with a valid JSON array (no markdown, no explanation). Each element must be:
{"index": <number>, "isRug": <boolean>, "specific": <boolean>, "placeName": "<name>" | null, "lat": <number> | null, "lng": <number> | null}`;

                const response = await fetch(
                  'https://api.anthropic.com/v1/messages',
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'x-api-key': apiKey,
                      'anthropic-version': '2023-06-01',
                    },
                    body: JSON.stringify({
                      model: 'claude-sonnet-4-20250514',
                      max_tokens: 4096,
                      messages: [{ role: 'user', content: prompt }],
                    }),
                  }
                );

                if (!response.ok) {
                  const errText = await response.text();
                  throw new Error(
                    `Anthropic API ${response.status}: ${errText}`
                  );
                }

                const data = await response.json();
                res.setHeader('Content-Type', 'application/json');

                if (data.content?.[0]?.text) {
                  const text = data.content[0].text;
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
                } else {
                  res.end(
                    JSON.stringify({
                      error: 'Empty LLM response',
                      data,
                    })
                  );
                }
              } catch (err: any) {
                console.error('LLM proxy error:', err);
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
              }
            }
          );
        },
      },
    ],
  };
});
