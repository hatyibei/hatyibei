// Snapshot the live sources the emaki shows (Zenn articles, GitHub repos) into site/data/.
// Runs in the Pages deploy job. A source that fails is skipped; the page then asks the source itself.
import { mkdir, writeFile } from 'node:fs/promises';

const out = new URL('../site/data/', import.meta.url);
await mkdir(out, { recursive: true });

const save = async (name, url, headers = {}) => {
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'hatyibei-emaki', ...headers } });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    await writeFile(new URL(name, out), JSON.stringify(await r.json()));
    console.log(`saved ${name}`);
  } catch (e) {
    console.warn(`skipped ${name}: ${e.message}`);
  }
};

await save('zenn.json', 'https://zenn.dev/api/articles?username=hatyibei&order=latest');
await save('github.json', 'https://api.github.com/users/hatyibei/repos?sort=pushed&per_page=30',
  process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {});
