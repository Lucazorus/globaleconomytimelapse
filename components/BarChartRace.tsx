"use client";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { REGION_LIST, regionColors } from "./Colors";
import PlayPauseButton from "./PlayPauseButton";

// Format espace pour les milliers
function formatNumberSpace(num) {
  if (typeof num !== "number" || isNaN(num)) return "";
  return num.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

const margin = { top: 40, right: 40, bottom: 20, left: 40 };
const MIN_BAR_LABEL_WIDTH = 100;

interface CountryData {
  year: number;
  gdp: number;
  country: string;
  region: string;
  [key: string]: any;
}

interface BarChartRaceProps {
  data: CountryData[];
  years: number[];
  year: number;
  animValue: number;
  playing: boolean;
  setPlaying: (v: boolean) => void;
  onYearChange: (v: any) => void;
  countryFocus: string | null;
  setCountryFocus: (v: string | null) => void;
  selectedRegions: string[] | null;
  setSelectedRegions: React.Dispatch<React.SetStateAction<string[] | null>>;
  isPerCapita?: boolean;
  topN: number;
  setTopN: (v: number) => void;
  metricLabel?: string;
}

export default function BarChartRace({
  data = [],
  years = [],
  year = 0,
  animValue = 0,
  playing,
  setPlaying,
  onYearChange,
  countryFocus,
  setCountryFocus,
  selectedRegions,
  setSelectedRegions,
  isPerCapita = false,
  topN,
  setTopN,
  metricLabel = "",
}: BarChartRaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const sliderRef = useRef<HTMLInputElement | null>(null);
  const topNSliderRef = useRef<HTMLInputElement | null>(null);

  // Responsive container
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 600 });
  useEffect(() => {
    function handleResize() {
      if (!containerRef.current) return;
      const width = containerRef.current.offsetWidth || 1200;
      const totalHeight = containerRef.current.offsetHeight || 600;
      const controlsHeight = 185;
      const height = Math.max(120, totalHeight - controlsHeight);
      setContainerSize({
        width: Math.max(360, width),
        height: Math.round(height),
      });
    }
    handleResize();
    const observer = new window.ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener("resize", handleResize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, []);
  const width = containerSize.width;
  const height = containerSize.height;

  // barHeight calculé dynamiquement pour remplir exactement l'espace disponible
  const chartHeight = height - margin.top - margin.bottom;
  const barPadding = Math.max(2, Math.floor(chartHeight / topN * 0.18));
  const barHeight = Math.max(4, Math.floor((chartHeight - barPadding * (topN - 1)) / topN));

  // Gradient du slider topN
  useEffect(() => {
    const el = topNSliderRef.current;
    if (!el) return;
    const percent = ((topN - 3) / (30 - 3)) * 100;
    el.style.setProperty("--progress", `${percent}%`);
  }, [topN]);

  // Région - logique AnimatedTreemap
  const regionListClean = REGION_LIST.filter(r => r !== "Other");
  const safeSelectedRegions =
    !selectedRegions || selectedRegions.length === 0
      ? regionListClean
      : selectedRegions.filter((r) => r !== "Other");

  // --- Désoulignement : state d'animation local React
  const [unselectingRegions, setUnselectingRegions] = useState<string[]>([]);

  function handleRegionToggle(region: string) {
    if (region === "Other") return;
    setSelectedRegions((current) => {
      if (!current || current === null) return [region];
      if (current.includes(region)) {
        setUnselectingRegions((prev) => [...prev, region]);
        setTimeout(() => {
          setUnselectingRegions((prev) => prev.filter(r => r !== region));
        }, 260);
        const next = current.filter((r) => r !== region);
        return next.length === 0 ? null : next;
      } else {
        return [...current, region];
      }
    });
  }
  function handleRegionClick(region: string) {
    if (region === "Other") return;
    setSelectedRegions((current) => {
      if (!current || current === null) return [region];
      if (current.includes(region)) return current;
      return [...current, region];
    });
  }
  function handleWorldClick() {
    setSelectedRegions(null);
  }

  // Animation (autoplay)
  const playingRef = useRef(playing);
  const yearRef = useRef(year);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { yearRef.current = year; }, [year]);
  useEffect(() => {
    if (!playing || !year || data.length === 0 || years.length === 0) return;
    let animating = true;
    const tick = () => {
      onYearChange((prev: number) => {
        if (!playingRef.current || !animating) return prev;
        const idx = years.indexOf(yearRef.current ?? years[0]);
        if (idx < years.length - 1) {
          const target = years[idx + 1];
          if (prev < target) {
            const next = Math.min(prev + 0.015, target);
            return next;
          } else {
            return target;
          }
        } else {
          setPlaying(false);
          return prev;
        }
      });
      if (playingRef.current && animating) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => {
      animating = false;
    };
  }, [playing, year, years, data, onYearChange, setPlaying]);

  // Focus GDP à afficher (synchronisé à chaque render)
  const [focusGDP, setFocusGDP] = useState<string>("");

  // ------- D3 render main -------
  useEffect(() => {
    if (!svgRef.current || data.length === 0 || years.length === 0) return;

    // --- Interpolation bar chart ---
    const yearFloat = animValue;
    const y1 = Math.floor(yearFloat);
    const y2 = Math.ceil(yearFloat);
    const t = animValue - y1;
    const y1Clamped = Math.max(years[0], Math.min(years[years.length - 1], y1));
    const y2Clamped = Math.max(years[0], Math.min(years[years.length - 1], y2));
    const regionsArray = safeSelectedRegions;

    function createKeyframe(yearVal: number) {
      let yearData = data.filter(
        (d) =>
          d.year === yearVal &&
          d.gdp > 0 &&
          d.region && d.region !== "Other" &&
          regionsArray.includes(d.region)
      );
      // Ne pas couper ici : on garde tous les pays pour pouvoir centrer sur le pays focusé
      const sorted = yearData
        .sort((a, b) => b.gdp - a.gdp)
        .map((d, i) => ({ ...d, rank: i }));
      const maxValue = Math.max(0, ...sorted.map((d) => d.gdp));
      return [yearVal, sorted, maxValue] as [number, CountryData[], number];
    }
    const kf1 = createKeyframe(y1Clamped);
    const kf2 = createKeyframe(y2Clamped);

    const mergedCountries = new Map<string, any>();
    if (kf1 && Array.isArray(kf1[1])) for (const d of kf1[1]) mergedCountries.set(d.country, { ...d, gdp1: d.gdp, gdp2: 0 });
    if (kf2 && Array.isArray(kf2[1])) for (const d of kf2[1]) {
      if (mergedCountries.has(d.country))
        mergedCountries.get(d.country)!.gdp2 = d.gdp;
      else
        mergedCountries.set(d.country, { ...d, gdp1: 0, gdp2: d.gdp });
    }
    const allSorted = Array.from(mergedCountries.values())
      .map((d) => ({ ...d, gdp: d.gdp1 * (1 - t) + d.gdp2 * t }))
      .filter((d) => d.gdp > 0)
      .sort((a, b) => b.gdp - a.gdp);

    // Fenêtre glissante : centrer sur le pays focusé
    const focusedRank = countryFocus
      ? allSorted.findIndex((d) => d.country === countryFocus)
      : -1;
    let windowStart = 0;
    if (focusedRank >= 0) {
      const ideal = focusedRank - Math.floor(topN / 2);
      const maxStart = Math.max(0, allSorted.length - topN);
      windowStart = Math.max(0, Math.min(ideal, maxStart));
    }
    const interpTop = allSorted.slice(windowStart, windowStart + topN);

    // GDP du pays focus à afficher (live) — même s’il n’est pas dans le topN
    if (countryFocus) {
      const focus = interpTop.find(d => d.country === countryFocus);
      if (focus) {
        setFocusGDP(
          isPerCapita
            ? `$${formatNumberSpace(focus.gdp)}`
            : `$${formatNumberSpace(Math.round(focus.gdp / 1e9))}B`
        );
      } else {
        // Cherche le GDP dans toute la donnée pour l’année actuelle (interpolé)
        const d1 = data.find(
          d =>
            d.country === countryFocus &&
            d.year === y1 &&
            d.gdp > 0 &&
            d.region &&
            d.region !== "Other"
        );
        const d2 = data.find(
          d =>
            d.country === countryFocus &&
            d.year === y2 &&
            d.gdp > 0 &&
            d.region &&
            d.region !== "Other"
        );
        let gdpInterp = null;
        if (d1 && d2) {
          gdpInterp = d1.gdp * (1 - t) + d2.gdp * t;
        } else if (d1) {
          gdpInterp = d1.gdp;
        } else if (d2) {
          gdpInterp = d2.gdp;
        }
        if (gdpInterp) {
          setFocusGDP(
            isPerCapita
              ? `$${formatNumberSpace(gdpInterp)}`
              : `$${formatNumberSpace(Math.round(gdpInterp / 1e9))}B`
          );
        } else {
          setFocusGDP("—");
        }
      }
    } else {
      setFocusGDP("");
    }

    // ----- RENDER D3 -----
    const interpMax = Math.max(...interpTop.map((d) => d.gdp), 1);
    const rankColWidth = 32;
    const chartLeft = margin.left + rankColWidth;
    const x = d3.scaleLinear().range([chartLeft, width - margin.right]);
    const y = (_d: any, i: number) => margin.top + i * (barHeight + barPadding);
    x.domain([0, interpMax * 1.08]);
    const svg = d3
      .select(svgRef.current)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", width)
      .attr("height", height);
    svg.selectAll("*").remove();

    // Lignes de grille verticales subtiles
    const tickValues = x.ticks(5);
    tickValues.forEach((tickVal) => {
      const xPos = x(tickVal);
      svg.append("line")
        .attr("x1", xPos).attr("x2", xPos)
        .attr("y1", margin.top)
        .attr("y2", margin.top + interpTop.length * (barHeight + barPadding))
        .attr("stroke", "rgba(255,255,255,0.05)")
        .attr("stroke-width", 1);
    });

    // Bars (track vide + barre remplie)
    svg
      .selectAll("g.bar")
      .data(interpTop, (d: any) => d.country)
      .join(
        (enter: any) => {
          const g = enter.append("g").attr("class", "bar");
          g.attr("transform", (_d: any, i: number) => `translate(0,${y(_d, i)})`);

          // Track (fond de barre vide)
          g.append("rect")
            .attr("class", "bar-track")
            .attr("x", chartLeft)
            .attr("y", 0)
            .attr("height", barHeight)
            .attr("width", width - margin.right - chartLeft)
            .attr("fill", "rgba(255,255,255,0.04)");

          // Barre remplie
          g.append("rect")
            .attr("class", "bar-fill")
            .attr("x", chartLeft)
            .attr("y", 0)
            .attr("height", barHeight)
            .attr("width", (d: any) => Math.max(0, x(d.gdp) - chartLeft))
            .attr("fill", (d: any) =>
              countryFocus && d.country === countryFocus
                ? "#FA003F"
                : regionColors(d.region)
            )
            .attr("cursor", "pointer")
            .on("click", (_e: any, d: any) => setCountryFocus(d.country));

          // Overlay gradient sur la barre
          g.append("rect")
            .attr("class", "bar-shine")
            .attr("x", chartLeft)
            .attr("y", 0)
            .attr("height", barHeight / 2)
            .attr("width", (d: any) => Math.max(0, x(d.gdp) - chartLeft))
            .attr("fill", "rgba(255,255,255,0.06)")
            .attr("pointer-events", "none");

          return g;
        },
        (update: any) => {
          update.attr("transform", (_d: any, i: number) => `translate(0,${y(_d, i)})`);
          update.select("rect.bar-fill")
            .attr("fill", (d: any) =>
              countryFocus && d.country === countryFocus
                ? "#FA003F"
                : regionColors(d.region)
            )
            .on("click", (_e: any, d: any) => setCountryFocus(d.country));
          return update;
        },
        (exit: any) => exit.remove()
      )
      .select("rect.bar-fill")
      .attr("width", (d: any) => Math.max(0, x(d.gdp) - chartLeft))
      .attr("fill", (d: any) =>
        countryFocus && d.country === countryFocus
          ? "#FA003F"
          : regionColors(d.region)
      )
      .on("click", (_e: any, d: any) => setCountryFocus(d.country));

    // Aussi mettre à jour la largeur du shine
    svg.selectAll("g.bar").each(function(d: any) {
      d3.select(this).select("rect.bar-shine")
        .attr("width", Math.max(0, x(d.gdp) - chartLeft));
    });

    // Labels
    svg.selectAll("text.country-label").remove();
    svg.selectAll("text.value-label").remove();
    svg.selectAll("text.rank-label").remove();

    interpTop.forEach((d: any, i: number) => {
      const barLen = Math.max(0, x(d.gdp) - chartLeft);
      const isFocused = countryFocus && d.country === countryFocus;
      const yMid = y(d, i) + barHeight / 2 + 5;

      // Taille de police adaptée à la hauteur de barre
      const fs = Math.max(7, Math.min(14, barHeight * 0.55));
      const fsRank = Math.max(6, Math.min(11, barHeight * 0.42));

      // Numéro de rang
      svg.append("text")
        .attr("class", "rank-label")
        .attr("x", margin.left + rankColWidth - 6)
        .attr("y", yMid)
        .attr("font-size", fsRank)
        .attr("fill", isFocused ? "#FA003F" : "rgba(255,255,255,0.35)")
        .attr("font-family", "Inter, Arial, sans-serif")
        .attr("font-weight", 600)
        .attr("text-anchor", "end")
        .attr("pointer-events", "none")
        .text(windowStart + i + 1);

      let countryX, valueX, anchor;
      const showOutside = barLen < MIN_BAR_LABEL_WIDTH;
      if (!showOutside) {
        countryX = x(d.gdp) - 10;
        valueX = x(d.gdp) + 10;
        anchor = "end";
      } else {
        countryX = x(d.gdp) + 8;
        valueX = x(d.gdp) + 8 + d.country.length * fs * 0.65 + 8;
        anchor = "start";
      }

      // Nom du pays
      svg.append("text")
        .attr("class", "country-label")
        .attr("x", countryX)
        .attr("y", yMid)
        .attr("font-size", fs)
        .attr("fill", "#fff")
        .attr("fill-opacity", isFocused ? 1 : 0.90)
        .attr("font-family", "Inter, Arial, sans-serif")
        .attr("font-weight", isFocused ? 600 : 400)
        .attr("letter-spacing", "0.04em")
        .attr("text-anchor", anchor)
        .attr("cursor", "pointer")
        .text(
          d.country.length < 20
            ? d.country.toUpperCase()
            : d.country.slice(0, 19).toUpperCase() + "…"
        )
        .on("click", () => setCountryFocus(d.country));

      // Valeur GDP
      const valueLabel = isPerCapita
        ? `$${formatNumberSpace(d.gdp)}`
        : `$${formatNumberSpace(Math.round(d.gdp / 1e9))}B`;
      svg.append("text")
        .attr("class", "value-label")
        .attr("x", valueX)
        .attr("y", yMid)
        .attr("font-size", fs)
        .attr("fill", isFocused ? "#FF8FAB" : "#a8d8ea")
        .attr("fill-opacity", 0.90)
        .attr("font-family", "Inter, Arial, sans-serif")
        .attr("font-weight", 500)
        .attr("letter-spacing", "0.03em")
        .attr("text-anchor", "start")
        .attr("cursor", "pointer")
        .text(valueLabel)
        .on("click", () => setCountryFocus(d.country));
    });

    // Axe X (lignes de grille + labels en haut)
    const axisG = svg.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${margin.top - 8})`);

    axisG.call(
      d3.axisTop(x)
        .tickValues(tickValues)
        .tickFormat(d => isPerCapita
          ? `$${formatNumberSpace(Number(d))}`
          : `$${formatNumberSpace(Math.round(Number(d) / 1e9))}B`
        )
        .tickSize(0)
    );

    axisG.select(".domain").remove();
    axisG.selectAll("text")
      .attr("font-size", 11)
      .attr("fill", "rgba(255,255,255,0.35)")
      .attr("font-family", "Inter, sans-serif")
      .attr("font-weight", 400)
      .attr("dy", "-0.4em");
  }, [
    animValue,
    selectedRegions,
    data,
    years,
    countryFocus,
    isPerCapita,
    width,
    height,
    playing,
    topN,
    barHeight,
    barPadding,
  ]);

  function handlePlayPause() {
    if (playing) {
      const snapped = Math.round(animValue);
      onYearChange(snapped);
      setPlaying(false);
    } else {
      if (animValue >= years[years.length - 1] - 0.01) {
        onYearChange(years[0]);
        setTimeout(() => setPlaying(true), 0);
      } else {
        setPlaying(true);
      }
    }
  }

  const countryList = Array.from(
    new Set(
      data
        .filter(
          (d) =>
            years.includes(d.year) &&
            d.region &&
            d.region !== "Other"
        )
        .map((d) => d.country)
    )
  ).sort();

  if (!year || years.length === 0) return <div>Loading…</div>;

  const selectedArr = Array.isArray(selectedRegions) ? selectedRegions : [];

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center gap-4 mt-4 w-full"
      style={{
        flex: 1,
        minHeight: 0,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Boutons région style AnimatedTreemap */}
      <div className="flex flex-wrap gap-3 justify-center p-4 rounded-2xl">
        <button
          onClick={handleWorldClick}
          className={`region-btn${!selectedRegions || selectedRegions.length === 0 ? " region-btn--active" : ""}`}
        >
          🌍 World
        </button>
        {regionListClean.map((region) => {
          const isActive = selectedArr.includes(region);
          const isUnselecting = unselectingRegions.includes(region);
          return (
            <button
              key={region}
              data-region={region}
              onClick={() =>
                isActive ? handleRegionToggle(region) : handleRegionClick(region)
              }
              className={[
                "region-btn",
                isActive ? "region-btn--active" : "",
                isUnselecting ? "unselecting" : ""
              ].join(" ")}
              style={
                isActive
                  ? {
                      background: `${regionColors(region)}22`,
                      boxShadow: `0 0 0 3px ${regionColors(region)}80, 0 4px 24px #2223`,
                    }
                  : {}
              }
              disabled={isUnselecting}
            >
              {region}
            </button>
          );
        })}
      </div>

      {/* Contrôles alignés */}
      <div
        className="center-controls-wrapper flex items-center gap-4 w-full"
        style={{
          minWidth: 300,
          maxWidth: 1400,
          margin: "0 auto",
          padding: "6px 0",
          fontSize: 13,
          lineHeight: "1.2",
        }}
      >
        <div className="shrink-0 flex items-center">
          <PlayPauseButton
            playing={playing}
            onClick={handlePlayPause}
            size={34}
            disabled={years.length < 2}
          />
        </div>
        {/* Slider */}
        <div className="flex-1 flex items-center justify-center min-w-[120px]">
          <input
            ref={sliderRef}
            type="range"
            min={years[0]}
            max={years[years.length - 1]}
            step={0.01}
            value={animValue}
            onChange={(e) => onYearChange(Math.round(Number(e.target.value)))}
            className="w-full h-1.5 bg-white/30 rounded-lg accent-blue-400"
            style={{ minWidth: 90, maxWidth: 250, height: 5 }}
          />
        </div>
        {/* Année */}
        <div className="flex flex-col justify-center items-center min-w-[60px]">
          <select
            value={Math.round(animValue)}
            onChange={(e) => onYearChange(Number(e.target.value))}
            className="select-glass px-2 py-1 text-[1rem] font-semibold text-center"
            style={{ minWidth: 48, fontSize: 15, padding: "3px 8px" }}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        {/* Slider nombre de pays */}
        <div className="flex flex-row items-center gap-2 ml-2" style={{ minWidth: 130 }}>
          <span style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.45)",
            fontFamily: "Inter, Arial, sans-serif",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            userSelect: "none",
          }}>
            Top
          </span>
          <input
            ref={topNSliderRef}
            type="range"
            min={3}
            max={30}
            step={1}
            value={topN}
            onChange={(e) => setTopN(Number(e.target.value))}
            style={{ width: 70, height: 5 }}
          />
          <span style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#fff",
            fontFamily: "Inter, Arial, sans-serif",
            minWidth: 22,
            textAlign: "left",
            userSelect: "none",
          }}>
            {topN}
          </span>
        </div>
        {/* Focus Country + PIB + Clear (style TreeMap) */}
        <div className="flex flex-row items-center min-w-[250px] ml-2" style={{ marginTop: 0 }}>
          <select
            value={countryFocus ?? ""}
            onChange={(e) => setCountryFocus(e.target.value || null)}
            className="select-glass px-2 py-1 min-w-[100px]"
            style={{ fontSize: 14, padding: "2px 8px" }}
          >
            <option value="">Focused Country</option>
            {countryList.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
          {countryFocus && (
            <span
              className="text-white text-xs select-none"
              style={{
                padding: "1px 9px",
                marginLeft: 7,
                marginRight: 5,
                fontSize: 15,
                fontWeight: 500,
                fontFamily: "Inter, Arial, sans-serif",
                letterSpacing: "0.04em",
                background: "rgba(255,255,255,0.09)",
                borderRadius: 7,
                minWidth: 80,
                display: "inline-block",
                textAlign: "center",
                lineHeight: "1.25",
                opacity: 0.93,
              }}
              title="GDP at this year"
            >
              {focusGDP || "—"}
            </span>
          )}
          {countryFocus && (
            <button
              onClick={() => setCountryFocus(null)}
              className="ml-2 text-white text-sm cursor-pointer select-none inline-flex items-center"
              style={{
                color: "#fff",  
                padding: "3px 12px",
                borderRadius: 8,
                border: "none",
                background: "#f9013f",
                marginLeft: 7,
                marginRight: 3,
                fontWeight: 400,
                fontFamily: "Inter, Arial, sans-serif",
                fontSize: 15,
                lineHeight: "1.25",
                transition: "background 0.18s",
              }}
              title="Clear"
              onMouseOver={e => (e.currentTarget.style.background = "#f9013f")}
              onMouseOut={e => (e.currentTarget.style.background = "#f9013f")}
            >
              Clear
            </button>
          )}
        </div>
      </div>
      {/* SVG */}
      <div
        className="w-full"
        style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "auto", position: "relative" }}
      >
        {/* Overlay année + métrique */}
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 16,
            zIndex: 10,
            pointerEvents: "none",
            lineHeight: 1,
          }}
        >
          <div style={{
            fontSize: "clamp(2.5rem, 6vw, 5rem)",
            fontWeight: 800,
            color: "rgba(255,255,255,0.10)",
            fontFamily: "Inter, Arial, sans-serif",
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}>
            {Math.round(animValue)}
          </div>
          {metricLabel && (
            <div style={{
              fontSize: "clamp(0.65rem, 1.2vw, 0.9rem)",
              fontWeight: 600,
              color: "rgba(255,255,255,0.20)",
              fontFamily: "Inter, Arial, sans-serif",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginTop: 2,
            }}>
              {metricLabel}
            </div>
          )}
        </div>
        <svg
          ref={svgRef}
          width={width}
          height={height}
          style={{
            display: "block",
            minWidth: 360,
            minHeight: 320,
            maxWidth: "100%",
          }}
        ></svg>
      </div>
    </div>
  );
}
