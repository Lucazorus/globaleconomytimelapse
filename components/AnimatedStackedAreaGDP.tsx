"use client";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { REGION_LIST, regionColors } from "./Colors";
import PlayPauseButton from "./PlayPauseButton";

export default function AnimatedStackedAreaGDP({
  data,
  years,
  animValue,
  playing,
  setPlaying,
  onYearChange,
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const lastDisplayedMaxY = useRef(1);
  const animationFrameRef = useRef(null);
  const [hoverRegion, setHoverRegion] = useState<string | null>(null);
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  // Animation Play
  const playingRef = useRef(playing);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => {
    if (!playing || years.length === 0) return;
    let animating = true;
    const tick = () => {
      onYearChange(prev => {
        if (!playingRef.current || !animating) return prev;
        if (prev >= years[years.length - 1]) {
          setPlaying(false);
          return prev;
        }
        return Math.min(prev + 0.07, years[years.length - 1]);
      });
      if (playingRef.current && animating) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => { animating = false; };
  }, [playing, years, onYearChange, setPlaying]);

  // Stack data and interpolate for animValue
  function prepareRegionStackedData(data, years, animValue) {
    const regionList = REGION_LIST.filter(r => r !== "Other");
    const regionTotals = {};
    for (const region of regionList) regionTotals[region] = 0;
    data.forEach(d => {
      if (regionTotals[d.region] !== undefined && d.gdp > 0) {
        regionTotals[d.region] += d.gdp;
      }
    });
    const regionOrder = regionList.slice().sort((a, b) => regionTotals[b] - regionTotals[a]);
    const yearIdx = d3.bisectLeft(years, animValue);
    const prevYear = years[Math.max(0, yearIdx - 1)];
    const nextYear = years[Math.min(years.length - 1, yearIdx)];
    const t =
      prevYear === nextYear
        ? 0
        : (animValue - prevYear) / (nextYear - prevYear || 1);

    const xYears = years.filter(y => y <= animValue);
    if (xYears.length === 0) xYears.push(years[0]);
    const lastX = animValue;
    const stackData = xYears.map(year => {
      const row = { year };
      for (const region of regionOrder) {
        row[region] = d3.sum(
          data.filter(d => d.year === year && d.region === region && d.gdp > 0),
          d => d.gdp
        );
      }
      return row;
    });
    if (animValue > xYears[xYears.length - 1] && prevYear !== nextYear) {
      const prevRow = stackData[stackData.length - 1];
      const nextRowRaw = {};
      for (const region of regionOrder) {
        nextRowRaw[region] = d3.sum(
          data.filter(d => d.year === nextYear && d.region === region && d.gdp > 0),
          d => d.gdp
        );
      }
      const interpRow = { year: animValue };
      for (const region of regionOrder) {
        interpRow[region] = (1 - t) * prevRow[region] + t * nextRowRaw[region];
      }
      stackData.push(interpRow);
    }
    return { stackData, regionOrder, xYears, lastX };
  }

  // Stack et maxY synchrone à chaque frame
  const { stackData, regionOrder, xYears, lastX } =
    prepareRegionStackedData(data, years, animValue);

  const stack = d3
    .stack()
    .keys(regionOrder)
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetNone);
  const allSeries = stack(stackData);

  const lastStack = allSeries
    .map(arr => arr && arr.length ? arr[arr.length - 1] : null)
    .filter(pt => pt && pt.length === 2 && typeof pt[1] === "number");
  const maxY = lastStack.length
    ? d3.max(lastStack, arr => arr[1]) || 1
    : 1;

  // Animation fluide de l'axe Y
  useEffect(() => {
    const animate = () => {
      const alpha = 0.08;
      const diff = Math.abs(lastDisplayedMaxY.current - maxY);
      if (diff > 0.001) {
        lastDisplayedMaxY.current =
          lastDisplayedMaxY.current * (1 - alpha) + maxY * alpha;
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        lastDisplayedMaxY.current = maxY;
      }
    };

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [maxY]);

  const displayedMaxY = lastDisplayedMaxY.current;

  let regionCenters: { [region: string]: number } = {};
  allSeries.forEach((serie, i) => {
    const region = regionOrder[i];
    if (serie.length > 0) {
      const last = serie[serie.length - 1];
      regionCenters[region] = ((last[0] + last[1]) / 2);
    }
  });

  useEffect(() => {
    if (!svgRef.current || data.length === 0 || years.length === 0) return;
    const width = 1600, height = 760;
    const margin = { top: 40, right: 40, bottom: 60, left: 180, rightLabel: 210 };

    const x = d3.scaleLinear()
      .domain([years[0], animValue])
      .range([margin.left, width - margin.right - margin.rightLabel]);
    const y = d3.scaleLinear()
      .domain([0, displayedMaxY])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const svg = d3
      .select(svgRef.current)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", width)
      .attr("height", height);
    svg.selectAll("*").remove();

    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(
        d3.axisBottom(x)
          .ticks(10)
          .tickFormat(d3.format("d"))
      )
      .selectAll("text")
      .attr("font-size", 17)
      .attr("font-family", "Inter, Arial, sans-serif")
      .attr("fill", "#cce");

    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(
        d3.axisLeft(y)
          .ticks(8)
          .tickFormat(d => "$" + d3.format(".2s")(d).replace("G", "T"))
      )
      .selectAll("text")
      .attr("font-size", 16)
      .attr("font-family", "Inter, Arial, sans-serif")
      .attr("fill", "#e5f3fa");

    // Areas
    allSeries.forEach((serie, i) => {
      const region = regionOrder[i];
      svg.append("path")
        .datum(serie)
        .attr("fill", regionColors(region))
        .attr("opacity", 0.93)
        .attr("stroke", "#000")
        .attr("stroke-width", 0)
        .attr("d", d3.area()
          .x((d, idx) =>
            idx === serie.length - 1
              ? x(lastX)
              : x(xYears[idx])
          )
          .y0(d => y(d[0]))
          .y1(d => y(d[1]))
          .curve(d3.curveMonotoneX)
        )
        .attr("cursor", "pointer")
        .on("mousemove", (event) => {
          const lastVal = serie[serie.length - 1];
          setHoverRegion(region);
          setHoverValue(lastVal[1] - lastVal[0]);
        })
        .on("mouseleave", () => {
          setHoverRegion(null);
          setHoverValue(null);
        });
    });

    // ----------- LABELS À DROITE, bien espacés et CLAMPÉS ----------
    const minLabelGap = 34;
    const labelTop = margin.top + 18;
    const labelBottom = height - margin.bottom - 8;
    const labelPositions = regionOrder.map(region => ({
      region,
      y: regionCenters[region] !== undefined ? y(regionCenters[region]) : 0,
    })).sort((a, b) => a.y - b.y);
    // Push labels down if overlap
    for (let i = 1; i < labelPositions.length; ++i) {
      if (labelPositions[i].y - labelPositions[i - 1].y < minLabelGap) {
        labelPositions[i].y = labelPositions[i - 1].y + minLabelGap;
      }
    }
    // Clamp dans le svg
    labelPositions.forEach(lp => {
      lp.y = Math.max(labelTop, Math.min(labelBottom, lp.y));
    });
    // Place labels
    labelPositions.forEach(({ region, y: yPos }) => {
      svg.append("text")
        .attr("x", width - margin.right + 60) // recule à droite, ajuste si besoin
        .attr("y", yPos)
        .attr("font-size", 17)
        .attr("font-family", "Inter, Arial, sans-serif")
        .attr("font-weight", region === hoverRegion ? 800 : 600)
        .attr("alignment-baseline", "middle")
        .attr("text-anchor", "start")
        .attr("fill", regionColors(region))
        .attr("paint-order", "stroke fill")
        .attr("stroke", "#202D2E")
        .attr("stroke-width", region === hoverRegion ? 3 : 2)
        .attr("opacity", 0.93)
        .style("cursor", "pointer")
        .text(region)
        .on("mousemove", () => {
          setHoverRegion(region);
          const idx = regionOrder.indexOf(region);
          if (allSeries[idx] && allSeries[idx].length > 0) {
            const last = allSeries[idx][allSeries[idx].length - 1];
            setHoverValue(last[1] - last[0]);
          }
        })
        .on("mouseleave", () => {
          setHoverRegion(null);
          setHoverValue(null);
        });
    });

    // Tooltip
    if (hoverRegion && hoverValue !== null) {
      const label = labelPositions.find(l => l.region === hoverRegion);
      const yVal = label ? label.y : y(regionCenters[hoverRegion] || 0);
      svg
        .append("foreignObject")
        .attr("x", width - margin.right + 120)
        .attr("y", yVal - 30)
        .attr("width", 250)
        .attr("height", 62)
        .append("xhtml:div")
        .style("background", regionColors(hoverRegion) + "DD")
        .style("border-radius", "20px")
        .style("padding", "11px 22px")
        .style("color", "#fff")
        .style("font-family", "Inter, Arial, sans-serif")
        .style("font-size", "17px")
        .style("box-shadow", "0 2px 12px #223b")
        .style("pointer-events", "none")
        .html(
          `<b>${hoverRegion}</b><br/>${d3.format("$,.2f")(hoverValue / 1e12)}T (GDP)`
        );
    }
  }, [data, animValue, years, hoverRegion, hoverValue, displayedMaxY, regionCenters, allSeries, regionOrder, lastX, xYears]);

  function handlePlayPause() {
    if (playing) {
      onYearChange(years[0]);
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

  const roundedYear = Math.round(animValue);

  return (
    <div className="flex flex-col items-center gap-6 mt-4">
      <div className="flex flex-wrap gap-3 justify-center p-4 rounded-2xl">
        <button
          onClick={() => {}}
          className="region-btn region-btn--active"
          disabled
          style={{ opacity: 0.8 }}
        >
          🌍 World
        </button>
      </div>
      <div className="center-controls-wrapper flex items-center gap-4 w-full" style={{ minWidth: 780, maxWidth: 1280, margin: "0 auto" }}>
        <div className="shrink-0 flex items-center">
          <PlayPauseButton
            playing={playing}
            onClick={handlePlayPause}
            size={48}
            disabled={years.length < 2}
          />
        </div>
        <div className="flex-1 flex items-center">
          <input
            type="range"
            min={years[0]}
            max={years[years.length - 1]}
            step={0.01}
            value={animValue}
            onChange={e => {
              setPlaying(false);
              onYearChange(Number(e.target.value));
            }}
            className="w-full h-2 bg-white/30 rounded-lg appearance-none cursor-pointer accent-blue-400"
            style={{ minWidth: 180, maxWidth: 350 }}
          />
        </div>
        <div>
          <select
            value={roundedYear}
            onChange={e => {
              setPlaying(false);
              onYearChange(Number(e.target.value));
            }}
            className="select-glass ml-3 px-3 py-2"
            style={{ minWidth: 100 }}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>
      <svg ref={svgRef}></svg>
    </div>
  );
}
