"use client";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { REGION_LIST, regionColors } from "./Colors";
import PlayPauseButton from "./PlayPauseButton";
import { flagEmoji } from "../lib/countryFlags";

interface CountryData {
  year: number;
  gdp: number;
  country: string;
  region: string;
  [key: string]: any;
}

interface BumpChartProps {
  data: CountryData[];
  years: number[];
  animValue: number;
  playing: boolean;
  setPlaying: (v: boolean) => void;
  onYearChange: (v: any) => void;
  countryFocus: string | null;
  setCountryFocus: (v: string | null) => void;
  selectedRegions: string[] | null;
  setSelectedRegions: React.Dispatch<React.SetStateAction<string[] | null>>;
  topN: number;
  setTopN: (v: number) => void;
  metricLabel?: string;
  isPerCapita?: boolean;
}

function formatValue(v: number, isPerCapita: boolean): string {
  if (!isFinite(v) || isNaN(v)) return "—";
  if (isPerCapita) return `$${v.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}`;
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  return `$${(v / 1e6).toFixed(0)}M`;
}

const margin = { top: 16, right: 130, bottom: 36, left: 80 };

export default function BumpChart({
  data = [],
  years = [],
  animValue = 0,
  playing,
  setPlaying,
  onYearChange,
  countryFocus,
  setCountryFocus,
  selectedRegions,
  setSelectedRegions,
  topN,
  setTopN,
  metricLabel = "",
  isPerCapita = false,
}: BumpChartProps) {
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
      const controlsHeight = 130;
      const h = Math.max(120, totalHeight - controlsHeight);
      setContainerSize({ width: Math.max(360, width), height: Math.round(h) });
    }
    handleResize();
    const observer = new window.ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener("resize", handleResize);
    return () => { observer.disconnect(); window.removeEventListener("resize", handleResize); };
  }, []);

  const width = containerSize.width;
  const height = containerSize.height;

  // ---- Tooltip ----
  const [tooltip, setTooltip] = useState<{
    show: boolean; x: number; y: number; name: string; value: number | null; region: string; year: number | null;
  }>({ show: false, x: 0, y: 0, name: "", value: null, region: "", year: null });

  const lastTooltipSeen = useRef(Date.now());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-close timeout
  useEffect(() => {
    if (tooltip.show) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        if (Date.now() - lastTooltipSeen.current >= 950) {
          setTooltip(tt => (tt.show ? { ...tt, show: false } : tt));
        }
      }, 1000);
    }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [tooltip.show, tooltip.x, tooltip.y]);

  // Window blur/mouseout = close tooltip
  useEffect(() => {
    function handleClose(e: MouseEvent | FocusEvent) {
      if (!(e as MouseEvent).relatedTarget || e.type === "blur") {
        setTooltip(tt => (tt.show ? { ...tt, show: false } : tt));
      }
    }
    window.addEventListener("mouseout", handleClose as EventListener);
    window.addEventListener("blur", handleClose as EventListener);
    return () => {
      window.removeEventListener("mouseout", handleClose as EventListener);
      window.removeEventListener("blur", handleClose as EventListener);
    };
  }, []);

  function touchTooltip() {
    lastTooltipSeen.current = Date.now();
  }

  // Region filter
  const regionListClean = REGION_LIST.filter(r => r !== "Other");
  const safeSelectedRegions =
    !selectedRegions || selectedRegions.length === 0
      ? regionListClean
      : selectedRegions.filter(r => r !== "Other");
  const selectedArr = Array.isArray(selectedRegions) ? selectedRegions : [];

  // Region toggle handlers (exact BarChartRace pattern)
  const [unselectingRegions, setUnselectingRegions] = useState<string[]>([]);
  function handleRegionToggle(region: string) {
    if (region === "Other") return;
    setSelectedRegions((current) => {
      if (!current || current === null) return [region];
      if (current.includes(region)) {
        setUnselectingRegions(prev => [...prev, region]);
        setTimeout(() => setUnselectingRegions(prev => prev.filter(r => r !== region)), 260);
        const next = current.filter(r => r !== region);
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

  // Animation loop
  const playingRef = useRef(playing);
  const yearRef = useRef(Math.round(animValue));
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { yearRef.current = Math.round(animValue); }, [animValue]);
  useEffect(() => {
    if (!playing || data.length === 0 || years.length === 0) return;
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
    return () => { animating = false; };
  }, [playing, animValue, years, data, onYearChange, setPlaying]);

  // Slider gradients
  useEffect(() => {
    const el = topNSliderRef.current;
    if (!el) return;
    const percent = ((topN - 3) / (30 - 3)) * 100;
    el.style.setProperty("--progress", `${percent}%`);
  }, [topN]);
  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;
    if (years.length < 2) return;
    const percent = ((animValue - years[0]) / (years[years.length - 1] - years[0])) * 100;
    el.style.setProperty("--progress", `${Math.max(0, Math.min(100, percent))}%`);
  }, [animValue, years]);

  function handlePlayPause() {
    if (playing) {
      setPlaying(false);
    } else {
      const currentYear = Math.round(animValue);
      if (currentYear >= years[years.length - 1]) {
        onYearChange(years[0]);
      }
      setPlaying(true);
    }
  }

  const [focusValue, setFocusValue] = useState<string>("");
  // Bumped after every static pass to force the head pass to re-run even when animValue hasn't changed.
  const [staticRenderKey, setStaticRenderKey] = useState(0);

  // Shared computed state between the two render passes
  // We store scales + visible countries in refs so the head-update pass can use them
  const scalesRef = useRef<{
    xScale: d3.ScalePoint<number>;
    yScale: d3.ScaleLinear<number, number>;
    gdpByYear: Map<number, Map<string, number>>;
    ranksByYear: Map<number, Map<string, number>>;
    visibleCountries: string[];
    countryRegion: Map<string, string>;
    innerH: number;
    innerW: number;
  } | null>(null);

  // Smooth Y-scale transition: instead of a hard jump, we lerp the displayed domain
  // toward the target domain on every animValue tick.
  const yDomainRef = useRef<{ curMin: number; curMax: number; targetMin: number; targetMax: number } | null>(null);
  // Track which "structural" inputs produced the last yDomainRef reset so we only
  // null-reset when data/filters/size actually change (not on every year tick).
  const yDomainResetKeyRef = useRef<string>("");

  // ------ D3 render — STATIC pass (axes + lines + past dots) ------
  // Depends on everything EXCEPT animValue's fractional part → keyed on currentYear (integer)
  const currentYear = Math.round(animValue);

  useEffect(() => {
    if (!svgRef.current || data.length === 0 || years.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    scalesRef.current = null;

    // Only null-reset the lerp domain when structural params change (not on year tick).
    // Key: everything except currentYear.
    const resetKey = `${data.length}|${selectedRegions?.join(",")}|${topN}|${width}|${height}|${isPerCapita}`;
    if (yDomainResetKeyRef.current !== resetKey) {
      yDomainRef.current = null;
      yDomainResetKeyRef.current = resetKey;
    }

    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    if (innerW <= 0 || innerH <= 0) return;

    const yearsToShow = years.filter(y => y <= currentYear);
    if (yearsToShow.length === 0) return;

    // Filter by region
    const filteredData = data.filter(
      d => d.gdp > 0 && d.region && d.region !== "Other" && safeSelectedRegions.includes(d.region)
    );

    // Build gdp + rank maps for ALL years
    const gdpByYear = new Map<number, Map<string, number>>();
    const ranksByYear = new Map<number, Map<string, number>>();
    years.forEach(y => {
      const yearData = filteredData.filter(d => d.year === y).sort((a, b) => b.gdp - a.gdp);
      const gm = new Map<string, number>();
      const rm = new Map<string, number>();
      yearData.forEach((d, i) => { gm.set(d.country, d.gdp); rm.set(d.country, i + 1); });
      gdpByYear.set(y, gm);
      ranksByYear.set(y, rm);
    });

    const totalCountries = ranksByYear.get(currentYear)?.size ?? 0;

    // Sliding window by rank at currentYear
    const currentRanks = ranksByYear.get(currentYear) ?? new Map();
    const focusedRank = countryFocus ? (currentRanks.get(countryFocus) ?? -1) : -1;
    let windowStart = 1;
    if (focusedRank > 0) {
      // Maximize countries above the focused one: place it as low as possible in the window
      const maxStart = Math.max(1, totalCountries - topN + 1);
      windowStart = Math.max(1, Math.min(focusedRank - topN + 1, maxStart));
    }
    const windowEnd = windowStart + topN - 1;

    const visibleSet = new Set<string>();
    currentRanks.forEach((rank, country) => {
      if (rank >= windowStart && rank <= windowEnd) visibleSet.add(country);
    });
    if (countryFocus && currentRanks.has(countryFocus)) visibleSet.add(countryFocus);
    const visibleCountries = Array.from(visibleSet);

    const countryRegion = new Map<string, string>();
    filteredData.forEach(d => { if (!countryRegion.has(d.country)) countryRegion.set(d.country, d.region); });

    // Update focus value
    if (countryFocus) {
      const gdp = gdpByYear.get(currentYear)?.get(countryFocus);
      setFocusValue(gdp != null ? formatValue(gdp, isPerCapita) : "—");
    } else {
      setFocusValue("");
    }

    // Y domain — computed on yearsToShow only so it grows with the animation.
    // The actual displayed domain is smoothly interpolated in the head pass via yDomainRef.
    let shownGdpValues: number[] = [];
    visibleCountries.forEach(country => {
      yearsToShow.forEach(y => {
        const v = gdpByYear.get(y)?.get(country);
        if (v != null && v > 0) shownGdpValues.push(v);
      });
    });
    if (shownGdpValues.length === 0) return;
    const targetYMin = Math.max(1, d3.min(shownGdpValues) ?? 1);
    const targetYMax = d3.max(shownGdpValues) ?? 1;

    // Initialise the lerp state if needed (first render or reset)
    if (!yDomainRef.current) {
      yDomainRef.current = {
        curMin: targetYMin,
        curMax: targetYMax,
        targetMin: targetYMin,
        targetMax: targetYMax,
      };
    } else {
      // Only update targets; curMin/curMax are advanced smoothly by the head pass
      yDomainRef.current.targetMin = targetYMin;
      yDomainRef.current.targetMax = targetYMax;
    }

    const { curMin, curMax } = yDomainRef.current;

    // Scales — use current (lerped) domain for the initial static draw
    const xScale = d3.scalePoint<number>()
      .domain(years)
      .range([0, innerW])
      .padding(0.1);

    const yScale = d3.scaleLinear()
      .domain([curMin * 0.85, curMax * 1.08])
      .range([innerH, 0])
      .clamp(true);

    // Save for the head-update pass
    scalesRef.current = { xScale, yScale, gdpByYear, ranksByYear, visibleCountries, countryRegion, innerH, innerW };

    function getY(country: string, year: number): number | null {
      const v = gdpByYear.get(year)?.get(country);
      if (v == null || v <= 0) return null;
      return yScale(v);
    }

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // X axis
    const maxLabels = Math.floor(innerW / 50);
    const step = Math.max(1, Math.ceil(years.length / maxLabels));
    const labelYears = years.filter((_, i) => i % step === 0);
    g.append("g")
      .attr("transform", `translate(0,${innerH + 10})`)
      .call(d3.axisBottom(xScale).tickValues(labelYears).tickSize(0).tickFormat(d => String(d)))
      .call(ax => ax.select(".domain").remove())
      .call(ax => ax.selectAll("text")
        .attr("fill", "rgba(255,255,255,0.35)")
        .attr("font-size", 11)
        .attr("font-family", "Inter, Arial, sans-serif")
      );

    // Y axis
    g.append("g").attr("class", "y-axis")
      .call(d3.axisLeft(yScale)
        .ticks(6)
        .tickFormat((d: d3.NumberValue) => {
          const v = +d;
          if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
          if (v >= 1e9)  return `$${(v / 1e9).toFixed(0)}B`;
          if (v >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`;
          return `$${v}`;
        })
        .tickSize(-innerW)
      )
      .call(ax => ax.select(".domain").remove())
      .call(ax => ax.selectAll(".tick line")
        .attr("stroke", "rgba(255,255,255,0.06)")
        .attr("stroke-dasharray", "3 3")
      )
      .call(ax => ax.selectAll(".tick text")
        .attr("fill", "rgba(255,255,255,0.28)")
        .attr("font-size", 10)
        .attr("font-family", "Inter, Arial, sans-serif")
        .attr("dx", "-4")
      );

    // Lines layer (static — drawn up to last integer year)
    const linesG = g.append("g").attr("class", "lines-layer");
    // Heads layer (updated every frame)
    g.append("g").attr("class", "heads-layer");

    const sorted = [...visibleCountries].sort((a, b) => {
      if (a === countryFocus) return 1;
      if (b === countryFocus) return -1;
      return 0;
    });

    const lineGen = d3.line<{ x: number; y: number }>()
      .x(d => d.x).y(d => d.y)
      .curve(d3.curveMonotoneX)
      .defined(d => isFinite(d.y));

    sorted.forEach(country => {
      const isFocused = country === countryFocus;
      const region = countryRegion.get(country) ?? "Other";
      const color = isFocused ? "#FA003F" : regionColors(region);
      const opacity = countryFocus && !isFocused ? 0.25 : 1;

      // Points up to currentYear (integers only for static pass)
      const points: { x: number; y: number }[] = [];
      yearsToShow.forEach(y => {
        const yPos = getY(country, y);
        if (yPos != null) points.push({ x: xScale(y) ?? 0, y: yPos });
      });
      if (points.length < 1) return;

      const cg = linesG.append("g")
        .attr("data-country", country)
        .style("cursor", "pointer")
        .on("click", () => setCountryFocus(isFocused ? null : country));

      if (points.length >= 2) {
        cg.append("path")
          .datum(points)
          .attr("d", lineGen)
          .attr("fill", "none")
          .attr("stroke", color)
          .attr("stroke-width", isFocused ? 2.5 : 1.5)
          .attr("stroke-opacity", opacity)
          .attr("stroke-linejoin", "round")
          .attr("stroke-linecap", "round");
      }

      // Past dots (all except the head — head is in the heads layer)
      // Build with year info for tooltip, skipping the last point (= head)
      const pastPoints = yearsToShow
        .map(y => {
          const v = gdpByYear.get(y)?.get(country);
          const yPos = v != null && v > 0 ? yScale(v) : null;
          return yPos != null ? { x: xScale(y) ?? 0, y: yPos, year: y, gdp: v! } : null;
        })
        .filter(Boolean) as { x: number; y: number; year: number; gdp: number }[];

      pastPoints.slice(0, -1).forEach(pt => {
        // Invisible hit area (larger) — same pattern as head dots
        cg.append("circle")
          .attr("class", "dot-hit")
          .attr("cx", pt.x).attr("cy", pt.y)
          .attr("r", (isFocused ? 2.5 : 1.8) + 6)
          .attr("fill", "transparent")
          .attr("stroke", "none")
          .style("cursor", "pointer")
          .on("mousemove", (event: MouseEvent) => {
            touchTooltip();
            setTooltip({
              show: true,
              x: event.clientX,
              y: event.clientY,
              name: country,
              value: pt.gdp,
              region: region,
              year: pt.year,
            });
          })
          .on("mouseleave", () => {
            setTooltip(tt => ({ ...tt, show: false }));
          });

        // Visible dot
        cg.append("circle")
          .attr("class", "dot-visible")
          .attr("cx", pt.x).attr("cy", pt.y)
          .attr("r", isFocused ? 2.5 : 1.8)
          .attr("fill", color)
          .attr("fill-opacity", opacity * 0.6)
          .attr("pointer-events", "none");
      });
    });

    // Signal the head pass to re-run (needed when animValue hasn't changed, e.g. on tab return)
    setStaticRenderKey(k => k + 1);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, years, currentYear, topN, countryFocus, selectedRegions, width, height, isPerCapita]);

  // ------ D3 render — HEAD pass (smooth interpolation every animValue tick) ------
  useEffect(() => {
    if (!svgRef.current || !scalesRef.current || !yDomainRef.current) return;
    const { xScale, gdpByYear, ranksByYear, visibleCountries, countryRegion, innerH, innerW } = scalesRef.current;

    // --- Smooth Y-domain lerp ---
    const dom = yDomainRef.current;
    const lerpSpeed = 0.08; // 0..1 per frame (lower = slower / smoother)
    dom.curMin += (dom.targetMin - dom.curMin) * lerpSpeed;
    dom.curMax += (dom.targetMax - dom.curMax) * lerpSpeed;

    // Rebuild yScale from the lerped domain
    const yScale = d3.scaleLinear()
      .domain([dom.curMin * 0.85, dom.curMax * 1.08])
      .range([innerH, 0])
      .clamp(true);

    // Save updated yScale for anything that reads scalesRef
    scalesRef.current.yScale = yScale;

    const svg = d3.select(svgRef.current);
    const g = svg.select<SVGGElement>("g");

    // Smoothly update the Y axis in-place (no full redraw)
    g.select<SVGGElement>(".y-axis")
      .call(d3.axisLeft(yScale)
        .ticks(6)
        .tickFormat((d: d3.NumberValue) => {
          const v = +d;
          if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
          if (v >= 1e9)  return `$${(v / 1e9).toFixed(0)}B`;
          if (v >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`;
          return `$${v}`;
        })
        .tickSize(-innerW)
      )
      .call(ax => ax.select(".domain").remove())
      .call(ax => ax.selectAll(".tick line")
        .attr("stroke", "rgba(255,255,255,0.06)")
        .attr("stroke-dasharray", "3 3")
      )
      .call(ax => ax.selectAll(".tick text")
        .attr("fill", "rgba(255,255,255,0.28)")
        .attr("font-size", 10)
        .attr("font-family", "Inter, Arial, sans-serif")
        .attr("dx", "-4")
      );

    // Interpolate GDP between two integer years — computed BEFORE line update
    // so we can append the live head point to every path, making lines follow the dot exactly.
    const f = animValue;
    const y1 = Math.floor(f);
    const y2 = Math.ceil(f);
    const t = f - y1; // 0..1 blend

    function getInterpolatedPoint(country: string): { x: number; y: number; gdp: number } | null {
      const v1 = gdpByYear.get(y1)?.get(country);
      const v2 = gdpByYear.get(y2)?.get(country);
      if (v1 == null && v2 == null) return null;
      const vInterp = ((v1 ?? v2 ?? 0) * (1 - t)) + ((v2 ?? v1 ?? 0) * t);
      if (vInterp <= 0) return null;
      const x1pos = xScale(y1) ?? 0;
      const x2pos = xScale(y2 <= years[years.length - 1] ? y2 : y1) ?? x1pos;
      const xInterp = x1pos + (x2pos - x1pos) * t;
      return { x: xInterp, y: yScale(vInterp), gdp: vInterp };
    }

    // Update lines in lines-layer: rescale past points + append live interpolated head point
    // so the drawn path always ends exactly where the head dot is.
    const linesG = g.select<SVGGElement>(".lines-layer");
    const lineGen = d3.line<{ x: number; y: number }>()
      .x(d => d.x).y(d => d.y)
      .curve(d3.curveMonotoneX)
      .defined(d => isFinite(d.y));
    const yearsToShow = years.filter(y => y <= y1);

    linesG.selectAll<SVGGElement, unknown>("g[data-country]").each(function() {
      const cg = d3.select(this);
      const country = cg.attr("data-country");
      if (!country) return;

      // Past integer-year points
      const points: { x: number; y: number }[] = [];
      yearsToShow.forEach(y => {
        const v = gdpByYear.get(y)?.get(country);
        if (v != null && v > 0) points.push({ x: xScale(y) ?? 0, y: yScale(v) });
      });

      // Append the live interpolated point so the line follows the head exactly.
      // Always add it (even at t=0 / integer year) so lines are always drawn to the head.
      const headPt = getInterpolatedPoint(country);
      if (headPt) points.push({ x: headPt.x, y: headPt.y });

      if (points.length >= 2) {
        cg.select("path").datum(points).attr("d", lineGen);
      }
      // Reposition past dots — 2 circles per dot (dot-hit + dot-visible), same position
      cg.selectAll<SVGCircleElement, unknown>("circle.dot-hit, circle.dot-visible")
        .each(function(_, i) {
          const ptIdx = Math.floor(i / 2); // 2 circles per point
          const pt = points[ptIdx];
          if (pt) d3.select(this).attr("cx", pt.x).attr("cy", pt.y);
        });
    });

    const headsG = g.select<SVGGElement>(".heads-layer");
    headsG.selectAll("*").remove();

    // Update focus value with interpolated GDP
    if (countryFocus) {
      const v1 = gdpByYear.get(y1)?.get(countryFocus);
      const v2 = gdpByYear.get(y2)?.get(countryFocus);
      if (v1 != null || v2 != null) {
        const vInterp = ((v1 ?? v2 ?? 0) * (1 - t)) + ((v2 ?? v1 ?? 0) * t);
        setFocusValue(formatValue(vInterp, isPerCapita));
      }
    }

    const sorted = [...visibleCountries].sort((a, b) => {
      if (a === countryFocus) return 1;
      if (b === countryFocus) return -1;
      return 0;
    });

    sorted.forEach(country => {
      const isFocused = country === countryFocus;
      const region = countryRegion.get(country) ?? "Other";
      const color = isFocused ? "#FA003F" : regionColors(region);
      const opacity = countryFocus && !isFocused ? 0.25 : 1;

      const pt = getInterpolatedPoint(country);
      if (!pt) return;

      const flag = flagEmoji(country);
      const dotR = isFocused ? 5 : 4;

      // Interpolate rank between y1 and y2 (round to nearest integer for display)
      const rank1 = ranksByYear.get(y1)?.get(country) ?? null;
      const rank2 = ranksByYear.get(y2)?.get(country) ?? null;
      const rankInterp = rank1 != null && rank2 != null
        ? Math.round(rank1 * (1 - t) + rank2 * t)
        : (rank1 ?? rank2 ?? null);

      const hg = headsG.append("g")
        .style("cursor", "pointer")
        .on("click", () => setCountryFocus(isFocused ? null : country));

      // Invisible larger hit area for tooltip
      hg.append("circle")
        .attr("cx", pt.x).attr("cy", pt.y)
        .attr("r", dotR + 8)
        .attr("fill", "transparent")
        .attr("stroke", "none")
        .on("mousemove", (event: MouseEvent) => {
          touchTooltip();
          setTooltip({
            show: true,
            x: event.clientX,
            y: event.clientY,
            name: country,
            value: pt.gdp,
            region: region,
            year: Math.round(animValue),
          });
        })
        .on("mouseleave", () => {
          setTooltip(tt => ({ ...tt, show: false }));
        });

      hg.append("circle")
        .attr("cx", pt.x).attr("cy", pt.y)
        .attr("r", dotR)
        .attr("fill", color)
        .attr("fill-opacity", opacity)
        .attr("stroke", isFocused ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)")
        .attr("stroke-width", isFocused ? 1.5 : 0.8)
        .attr("pointer-events", "none");

      // Flag above the dot
      const aboveY = pt.y - dotR - 3;
      const flagSize = isFocused ? 16 : 13;

      if (flag) {
        hg.append("text")
          .attr("x", pt.x)
          .attr("y", aboveY)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "auto")
          .attr("font-size", flagSize)
          .attr("opacity", opacity)
          .attr("pointer-events", "none")
          .text(flag);
      }

      // "N. Country name" label to the right of the dot
      const label = country.length > 13 ? country.slice(0, 12) + "…" : country;
      const rankPrefix = rankInterp != null ? `${rankInterp}. ` : "";
      hg.append("text")
        .attr("x", pt.x + dotR + 5)
        .attr("y", pt.y)
        .attr("dominant-baseline", "middle")
        .attr("font-size", isFocused ? 12 : 10)
        .attr("font-weight", isFocused ? 700 : 400)
        .attr("font-family", "Inter, Arial, sans-serif")
        .attr("fill", isFocused ? "#FA003F" : color)
        .attr("opacity", countryFocus && !isFocused ? 0.45 : 0.85)
        .attr("pointer-events", "none")
        .text(`${rankPrefix}${label}`);
    });

  }, [animValue, countryFocus, staticRenderKey]);

  const roundedYear = Math.round(animValue);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        background: "transparent",
      }}
    >
      {/* TOOLTIP */}
      {tooltip.show && (
        <div
          style={{
            position: "fixed",
            pointerEvents: "none",
            top: tooltip.y - 80,
            left: tooltip.x + 12,
            background: "rgba(15,22,30,0.97)",
            color: "#fff",
            borderRadius: 12,
            padding: "10px 16px 10px 14px",
            minWidth: 140,
            zIndex: 1001,
            boxShadow: "0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            fontFamily: "Inter, Arial, sans-serif",
            backdropFilter: "blur(8px)",
          }}
          onMouseMove={touchTooltip}
        >
          {/* Badge région */}
          <span style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            color: regionColors(tooltip.region),
            marginBottom: 4,
            opacity: 0.9,
          }}>
            {tooltip.region}
          </span>
          <span style={{
            fontWeight: 500,
            fontSize: 15,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            marginBottom: 2,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            color: "#fff",
          }}>
            {tooltip.name}
          </span>
          {tooltip.year != null && (
            <span style={{
              fontSize: 11,
              fontWeight: 400,
              color: "rgba(255,255,255,0.45)",
              fontFamily: "Inter, Arial, sans-serif",
              marginBottom: 4,
              lineHeight: 1.2,
            }}>
              {tooltip.year}
            </span>
          )}
          <span style={{
            fontWeight: 300,
            fontSize: 14,
            opacity: 0.85,
            whiteSpace: "nowrap",
            lineHeight: 1.2,
            color: "#a8d8ea",
            letterSpacing: "0.02em",
          }}>
            {tooltip.value !== null ? formatValue(tooltip.value, isPerCapita) : "—"}
          </span>
        </div>
      )}

      {/* Region buttons — exact BarChartRace pattern, BEFORE controls */}
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
              onClick={() => isActive ? handleRegionToggle(region) : handleRegionClick(region)}
              className={[
                "region-btn",
                isActive ? "region-btn--active" : "",
                isUnselecting ? "unselecting" : "",
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

      {/* Controls bar */}
      <div
        className="center-controls-wrapper flex items-center gap-4 w-full"
        style={{
          minWidth: 300,
          maxWidth: 1400,
          margin: "0 auto",
          padding: "6px 0 2px",
          fontSize: 13,
          lineHeight: "1.2",
          flexShrink: 0,
        }}
      >
        {/* Année + Métrique */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1, minWidth: 80, flexShrink: 0 }}>
          <span style={{
            fontSize: "2rem",
            fontWeight: 800,
            color: "rgba(255,255,255,0.85)",
            fontFamily: "Inter, Arial, sans-serif",
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}>
            {roundedYear}
          </span>
          {metricLabel && (
            <span style={{
              fontSize: "0.6rem",
              fontWeight: 600,
              color: "rgba(255,255,255,0.35)",
              fontFamily: "Inter, Arial, sans-serif",
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              marginTop: 2,
              lineHeight: 1,
            }}>
              {metricLabel}
            </span>
          )}
        </div>

        {/* Slider */}
        <div className="flex-1 flex items-center justify-center min-w-[120px]">
          <input
            ref={sliderRef}
            type="range"
            min={years[0]}
            max={years[years.length - 1]}
            step={1}
            value={roundedYear}
            onChange={(e) => {
              setPlaying(false);
              onYearChange(Number(e.target.value));
            }}
            className="w-full h-1.5 bg-white/30 rounded-lg accent-blue-400"
            style={{ minWidth: 90, maxWidth: 250, height: 5 }}
          />
        </div>

        {/* Play/Pause */}
        <div className="shrink-0">
          <PlayPauseButton
            playing={playing}
            onClick={handlePlayPause}
            size={34}
            disabled={years.length < 2}
          />
        </div>

        {/* Year select */}
        <div className="flex flex-col justify-center items-center min-w-[60px]">
          <select
            value={roundedYear}
            onChange={(e) => {
              setPlaying(false);
              onYearChange(Number(e.target.value));
            }}
            className="select-glass px-2 py-1 text-[1rem] font-semibold text-center"
            style={{ minWidth: 48, fontSize: 15, padding: "3px 8px" }}
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Top N slider */}
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

        {/* Focus country display */}
        {countryFocus && (
          <div className="flex flex-row items-center ml-2">
            <span style={{
              fontSize: 13,
              fontWeight: 500,
              color: "rgba(255,255,255,0.7)",
              fontFamily: "Inter, Arial, sans-serif",
              marginRight: 4,
            }}>
              {flagEmoji(countryFocus)} {countryFocus}
            </span>
            {focusValue && (
              <span style={{
                padding: "1px 9px",
                marginLeft: 7,
                marginRight: 5,
                fontSize: 15,
                fontWeight: 500,
                fontFamily: "Inter, Arial, sans-serif",
                background: "rgba(255,255,255,0.09)",
                borderRadius: 7,
                minWidth: 80,
                display: "inline-block",
                textAlign: "center",
                lineHeight: "1.25",
                opacity: 0.93,
              }} title="GDP">
                {focusValue}
              </span>
            )}
            <button
              onClick={() => setCountryFocus(null)}
              style={{
                color: "#fff",
                padding: "2px 10px",
                borderRadius: 8,
                border: "none",
                background: "#f9013f",
                marginLeft: 7,
                fontWeight: 400,
                fontFamily: "Inter, Arial, sans-serif",
                fontSize: 13,
                lineHeight: "1.25",
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* SVG — prend le reste de l'espace */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <svg
          ref={svgRef}
          width={width}
          height={height}
          style={{ display: "block", overflow: "visible" }}
        />
      </div>
    </div>
  );
}
