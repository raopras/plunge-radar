#!/usr/bin/env node
// Publish-time SEO audit of the built site (_site/). Runs in the GitHub Action after
// the build; any issue fails the run so a broken page never goes live.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '..', '_site');
const dec = (s) => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');

export function audit(outDir = OUT) {
  const pages = ['index.html', ...readdirSync(outDir)
    .filter((d) => existsSync(join(outDir, d, 'index.html'))).map((d) => `${d}/index.html`)];
  const issues = [];
  const seen = { title: new Map(), description: new Map(), h1: new Map() };

  for (const p of pages) {
    const h = readFileSync(join(outDir, p), 'utf8');
    const title = dec(h.match(/<title>([^<]*)/)?.[1] || '');
    const description = dec(h.match(/name="description" content="([^"]*)/)?.[1] || '');
    const h1s = h.match(/<h1[^>]*>([^<]*)<\/h1>/g) || [];
    const hero = h.split('</header>')[0];

    if (!title) issues.push(`${p}: missing <title>`);
    if (title.length > 60) issues.push(`${p}: title is ${title.length} characters (max 60)`);
    if (description.length < 70 || description.length > 155) issues.push(`${p}: description is ${description.length} characters (70–155)`);
    if (h1s.length !== 1) issues.push(`${p}: ${h1s.length} H1 headings (need exactly 1)`);
    if (!/rel="canonical" href="https:\/\//.test(h)) issues.push(`${p}: missing canonical URL`);
    if (!/lang="en-GB"/.test(h)) issues.push(`${p}: missing lang="en-GB"`);
    for (const tag of ['og:title', 'og:description', 'og:image', 'og:url', 'og:locale', 'twitter:card']) {
      if (!h.includes(tag)) issues.push(`${p}: missing ${tag}`);
    }
    for (const m of h.matchAll(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)) {
      try { JSON.parse(m[1]); } catch { issues.push(`${p}: invalid structured data`); }
    }
    if (/href="#"/.test(h)) issues.push(`${p}: dead "#" link`);
    if (/Octopus Agile/.test(h)) issues.push(`${p}: uses "Octopus Agile" (the tariff is "Agile Octopus")`);
    if (!/tariff/i.test(hero)) issues.push(`${p}: the opening section doesn't say Agile Octopus is a tariff`);
    if (/<img(?![^>]*\balt=)[^>]*>/.test(h)) issues.push(`${p}: image without alt text`);

    for (const [k, v] of [['title', title], ['description', description], ['h1', h1s[0] || '']]) {
      if (seen[k].has(v)) issues.push(`${p}: same ${k} as ${seen[k].get(v)}`);
      seen[k].set(v, p);
    }
  }

  const sitemap = existsSync(join(outDir, 'sitemap.xml')) ? readFileSync(join(outDir, 'sitemap.xml'), 'utf8') : '';
  const locs = (sitemap.match(/<loc>/g) || []).length;
  if (locs !== pages.length) issues.push(`sitemap.xml lists ${locs} pages, the site has ${pages.length}`);
  const robots = existsSync(join(outDir, 'robots.txt')) ? readFileSync(join(outDir, 'robots.txt'), 'utf8') : '';
  if (!/Sitemap: https:\/\//.test(robots)) issues.push('robots.txt does not point to the sitemap');
  if (!existsSync(join(outDir, '404.html'))) issues.push('missing 404.html');

  return { pages: pages.length, issues };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { pages, issues } = audit();
  if (issues.length) {
    console.error(`SEO audit failed (${issues.length} issue${issues.length === 1 ? '' : 's'} across ${pages} pages):\n- ${issues.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`SEO audit passed: ${pages} pages, no issues.`);
}
