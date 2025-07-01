// regionColors.ts

import * as d3 from "d3";

// La liste officielle des régions (ordre alphabétique)
export const REGION_LIST = [
  "Africa",
  "Asia",
  "Central America",
  "Europe",
  "Middle East",
  "North America",
  "Oceania",
  "Other",
  "South America",
] as const;

// Palette pastel harmonieuse (clé = nom de la région, valeur = couleur)
export const REGION_PALETTE: Record<(typeof REGION_LIST)[number], string> = {
  Africa: "#6FAFAC",           // jaune sable doux, chaud et élégant
  Asia: "#D8AF47",             // vert menthe pastel lumineux
  "Central America": "#70A9AF",// vert pistache pastel frais
  Europe: "#719CAF",           // bleu pastel profond, moderne
  "Middle East": "#1B4965",    // beige pastel doré, chaleur du désert
  "North America": "#6FAF96",  // rose pastel corail doux mais bien visible
  Oceania: "#CC5803",          // bleu ardoise pastel, léger et sophistiqué
  Other: "#CCCCCC",            // gris neutre
  "South America": "#6FAF84",  // orange pastel abricot lumineux
};

// Scale D3 qui matche région → couleur
export const regionColors = d3.scaleOrdinal<string, string>()
  .domain(REGION_LIST)
  .range(REGION_LIST.map(region => REGION_PALETTE[region]));
