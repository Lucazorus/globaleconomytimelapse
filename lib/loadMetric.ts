// Chargement à la demande des données d'une métrique.
// Les fichiers compacts (générés par scripts/compact-data.mjs) sont décodés
// vers le format "ligne par ligne" attendu par les composants de graphe.

export type MetricType = "gdp" | "percap" | "ppp";

export type GdpRow = {
  country: string;
  year: number;
  gdp: number;
  region: string;
};

export type MetricDataset = {
  rows: GdpRow[];
  years: number[];
};

type CompactFile = {
  regions: string[];
  series: [string, number, number, (number | null)[]][];
};

const METRIC_FILES: Record<MetricType, string> = {
  gdp: "/data/compact/gdp.json",
  percap: "/data/compact/percap.json",
  ppp: "/data/compact/ppp.json",
};

export async function loadMetric(metric: MetricType): Promise<MetricDataset> {
  const res = await fetch(METRIC_FILES[metric]);
  if (!res.ok) throw new Error(`Failed to load ${METRIC_FILES[metric]}: ${res.status}`);
  const compact: CompactFile = await res.json();

  const rows: GdpRow[] = [];
  const yearsSet = new Set<number>();

  for (const [country, regionIdx, startYear, values] of compact.series) {
    const region = compact.regions[regionIdx];
    for (let i = 0; i < values.length; i++) {
      const gdp = values[i];
      if (gdp == null) continue;
      const year = startYear + i;
      rows.push({ country, year, gdp, region });
      yearsSet.add(year);
    }
  }

  const years = Array.from(yearsSet).sort((a, b) => a - b);
  return { rows, years };
}
