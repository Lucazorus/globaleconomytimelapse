"use client";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { REGION_LIST, regionColors } from "./Colors";

const REGION_CENTERS: Record<string, { x: number, y: number }> = {
  "North America": { x: 360, y: 260 },
  "South America": { x: 260, y: 600 },
  "Europe":       { x: 720, y: 220 },
  "Asia":         { x: 900, y: 440 },
  "Africa":       { x: 500, y: 600 },
  "Oceania":      { x: 1000, y: 700 },
  "Central America": { x: 190, y: 350 },
  "Caribbean":    { x: 140, y: 200 },
  "Middle East":  { x: 780, y: 550 },
  "Other":        { x: 1100, y: 120 },
};

const WIDTH = 1200;
const HEIGHT = 820;

const DATA_URL = "/data/gdp_by_country_year_with_region.json";

export default function GDPBubblePack() {
  const [gdpData, setGdpData] = useState<any[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [animYear, setAnimYear] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // Chargement des données
  useEffect(() => {
    fetch(DATA_URL)
      .then(res => res.json())
      .then(json => {
        setGdpData(json);
        const yearList = Array.from(new Set(json.map((d: any) => d.year))).sort((a, b) => a - b);
        setYears(yearList);
        setYear(yearList[yearList.length - 1]);
        setAnimYear(yearList[yearList.length - 1]);
      });
  }, []);

  // Animation slider
  useEffect(() => {
    if (!playing || !year || !years.length) return;
    let stop = false;
    const animate = () => {
      if (!playing || stop || !year || !years.length) return;
      const idx = years.indexOf(year);
      if (idx < years.length - 1) {
        const next = years[idx + 1];
        setAnimYear(y => {
          if (!y) return year;
          if (y < next) return +(y + 0.12).toFixed(2);
          setYear(next);
          return next;
        });
        setTimeout(animate, 16);
      } else {
        setPlaying(false);
      }
    };
    animate();
    return () => { stop = true; };
    // eslint-disable-next-line
  }, [playing, year, years]);

  useEffect(() => { if (year !== null) setAnimYear(year); }, [year]);

  // Affichage du pack D3
  useEffect(() => {
    if (!gdpData.length || animYear === null) return;

    const svg = d3.select(svgRef.current)
      .attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`)
      .attr("width", WIDTH)
      .attr("height", HEIGHT);

    svg.selectAll("*").remove();

    // A. Data pour l'année
    const filtered = gdpData
      .filter(d => Math.round(d.year) === Math.round(animYear))
      .filter(d => d.gdp > 0);

    // B. Groupes région → pays (hiérarchie)
    const regionGroups = d3.groups(filtered, d => d.region || "Other")
      .map(([region, arr]) => ({
        name: region,
        children: arr.map(d => ({
          name: d.country,
          value: d.gdp,
          region: d.region || "Other"
        }))
      }));

    // C. Hierarchie pour d3.pack
    const root = d3.hierarchy({ name: "World", children: regionGroups })
      .sum(d => (d as any).value || 0);

    // D. d3.pack sur régions
    d3.pack()
      .size([WIDTH, HEIGHT])
      .padding(8)
      (root);

    // E. Figer les centres de chaque région (depth == 1)
    root.children?.forEach(regionNode => {
      const center = REGION_CENTERS[regionNode.data.name] || { x: WIDTH/2, y: HEIGHT/2 };
      regionNode.x = center.x;
      regionNode.y = center.y;
    });

    // F. Redéfinir la position des enfants selon les centres imposés
    root.children?.forEach(regionNode => {
      regionNode.children?.forEach(child => {
        child.x += regionNode.x - child.parent!.x;
        child.y += regionNode.y - child.parent!.y;
      });
    });

    // G. Afficher les bulles par pays (depth==2)
    const countryNodes = (root.leaves() as any[]);

    svg.selectAll("circle.country")
      .data(countryNodes)
      .join("circle")
      .attr("class", "country")
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
      .attr("r", d => d.r)
      .attr("fill", d => regionColors(d.data.region))
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .attr("opacity", 0.88);

    // H. Labels pays
    svg.selectAll("text.country-label")
      .data(countryNodes)
      .join("text")
      .attr("class", "country-label")
      .attr("x", d => d.x)
      .attr("y", d => d.y - 4)
      .attr("text-anchor", "middle")
      .attr("font-size", d => Math.max(11, Math.min(d.r / 3, 24)))
      .attr("fill", "#fff")
      .attr("font-weight", 700)
      .attr("pointer-events", "none")
      .attr("opacity", d => d.r > 19 ? 0.95 : 0.0)
      .text(d => d.data.name);

    // I. Value labels
    svg.selectAll("text.country-value")
      .data(countryNodes)
      .join("text")
      .attr("class", "country-value")
      .attr("x", d => d.x)
      .attr("y", d => d.y + 18)
      .attr("text-anchor", "middle")
      .attr("font-size", d => Math.max(10, Math.min(d.r / 4, 18)))
      .attr("fill", "#fff")
      .attr("font-weight", 400)
      .attr("pointer-events", "none")
      .attr("opacity", d => d.r > 23 ? 0.82 : 0.0)
      .text(d => d.data.value ? `${d3.format(",.1f")(d.data.value / 1e9)}B` : "");

    // J. Dessiner bulles régions (en fond)
    if (root.children) {
      svg.selectAll("circle.region")
        .data(root.children)
        .join("circle")
        .attr("class", "region")
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        .attr("r", d => d.r)
        .attr("fill", d => regionColors(d.data.name) + "16")
        .attr("stroke", d => regionColors(d.data.name))
        .attr("stroke-width", 3)
        .attr("opacity", 0.23);
      // Labels région (si place)
      svg.selectAll("text.region-label")
        .data(root.children)
        .join("text")
        .attr("class", "region-label")
        .attr("x", d => d.x)
        .attr("y", d => d.y)
        .attr("text-anchor", "middle")
        .attr("font-size", d => Math.max(22, d.r / 6))
        .attr("font-weight", 800)
        .attr("fill", "#FECF56")
        .attr("opacity", d => d.r > 40 ? 0.8 : 0.2)
        .attr("pointer-events", "none")
        .text(d => d.data.name);
    }
  }, [gdpData, animYear]);

  if (!year || !years.length) return <div>Loading…</div>;

  return (
    <div className="flex flex-col gap-4 items-center" style={{ overflowX: "auto", maxWidth: "100vw" }}>
      <h2 className="text-2xl font-bold mt-4 text-slate-100 text-center drop-shadow">
        GDP Bubble Pack by Region
      </h2>
      <div className="w-full flex flex-col items-center mb-2">
        <div className="w-full max-w-xl flex items-center gap-4 bg-white/10 rounded-xl px-4 py-3 mb-2 shadow backdrop-blur-md border border-[#223334]">
          <button
            onClick={() => setPlaying(p => !p)}
            className={`region-btn${playing ? " region-btn--active" : ""} text-lg px-7 py-3`}
          >
            {playing ? "Pause" : "Play"}
          </button>
          <input
            type="range"
            min={years[0]}
            max={years[years.length - 1]}
            step="0.01"
            value={animYear ?? year}
            onChange={e => {
              setPlaying(false);
              setYear(Math.round(Number(e.target.value)));
              setAnimYear(Number(e.target.value));
            }}
            className="flex-1"
          />
        </div>
        <div className="w-full flex justify-end mb-1 pr-7">
          <span
            className="font-mono text-4xl md:text-6xl font-extrabold drop-shadow-lg px-2 min-w-[80px] text-center"
            style={{ color: "#fff", letterSpacing: "0.04em", textShadow: "0 2px 16px #111, 0 0 6px #fff5" }}
          >
            {Math.round(animYear ?? year)}
          </span>
        </div>
      </div>
      <div className="w-full overflow-x-auto flex justify-center">
        <svg ref={svgRef}></svg>
      </div>
    </div>
  );
}
