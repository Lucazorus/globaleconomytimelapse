// Convertit les JSON "ligne par ligne" de public/data en format colonnaire compact.
//
// Format de sortie (un fichier par métrique, lu par lib/loadMetric.ts) :
//   {
//     "regions": ["Africa", "Asia", ...],
//     "series": [
//       ["Aruba", <indexRegion>, <annéeDébut>, [v1, v2, null, v4, ...]],
//       ...
//     ]
//   }
// Les trous dans la série sont des null ; les valeurs sont arrondies
// (dollar près pour le PIB total, centime près pour les PIB/habitant).
//
// Usage : node scripts/compact-data.mjs

import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "public", "data");
const outDir = join(dataDir, "compact");
mkdirSync(outDir, { recursive: true });

const SOURCES = [
  { src: "gdp_by_country_year_with_region.json", out: "gdp.json", decimals: 0 },
  { src: "gdp_per_capita_by_country_year.json", out: "percap.json", decimals: 2 },
  { src: "gdp_per_capita_ppp_by_country_year.json", out: "ppp.json", decimals: 2 },
];

for (const { src, out, decimals } of SOURCES) {
  const srcPath = join(dataDir, src);
  const rows = JSON.parse(readFileSync(srcPath, "utf8"));

  const regions = [];
  const regionIdx = new Map();
  const byCountry = new Map();

  for (const { country, year, gdp, region } of rows) {
    if (gdp == null || country == null || year == null) continue;
    const reg = region ?? "Other";
    if (!regionIdx.has(reg)) {
      regionIdx.set(reg, regions.length);
      regions.push(reg);
    }
    if (!byCountry.has(country)) {
      byCountry.set(country, { region: regionIdx.get(reg), years: new Map() });
    }
    byCountry.get(country).years.set(year, gdp);
  }

  const factor = 10 ** decimals;
  const series = [];
  for (const [country, { region, years }] of byCountry) {
    const yearList = [...years.keys()].sort((a, b) => a - b);
    const start = yearList[0];
    const end = yearList[yearList.length - 1];
    const values = [];
    for (let y = start; y <= end; y++) {
      const v = years.get(y);
      values.push(v == null ? null : Math.round(v * factor) / factor);
    }
    series.push([country, region, start, values]);
  }
  series.sort((a, b) => a[0].localeCompare(b[0]));

  const outPath = join(outDir, out);
  writeFileSync(outPath, JSON.stringify({ regions, series }));

  const before = statSync(srcPath).size;
  const after = statSync(outPath).size;
  console.log(
    `${src} (${(before / 1024).toFixed(0)} KB) -> compact/${out} (${(after / 1024).toFixed(0)} KB, -${(100 - (after / before) * 100).toFixed(0)}%)`
  );
}
