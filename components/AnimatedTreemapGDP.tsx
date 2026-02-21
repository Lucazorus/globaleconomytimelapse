"use client";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { REGION_LIST, regionColors } from "./Colors";
import PlayPauseButton from "./PlayPauseButton";

// Format espace pour les milliers
function formatNumberSpace(n) {
  if (typeof n !== "number" || isNaN(n)) return "";
  return n.toLocaleString("fr-FR").replace(/\u202f/g, " ");
}

export default function AnimatedTreemapGDP({
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
  freeForAll,
  setFreeForAll,
  proportional,
  setProportional,
  mode,
  metricLabel = "",
}) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const sliderRef = useRef(null);

  const [focusRerender, setFocusRerender] = useState(0);

  const [tooltip, setTooltip] = useState({
    show: false,
    x: 0,
    y: 0,
    name: "",
    value: null,
  });

  // Pour le timeout ultime anti-bug
  const lastTooltipSeen = useRef(Date.now());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // TIMEOUT AUTOCLOSE du tooltip si rien ne le ferme "proprement"
  useEffect(() => {
    if (tooltip.show) {
      // Clear timeout si déjà lancé
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      // Programme une fermeture forcée après 1000ms sans mousemove
      timeoutRef.current = setTimeout(() => {
        if (Date.now() - lastTooltipSeen.current >= 950) {
          setTooltip(tt => (tt.show ? { ...tt, show: false } : tt));
        }
      }, 1000);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [tooltip.show, tooltip.x, tooltip.y]);

  // Mise à jour du "dernier mouvement"
  function touchTooltip() {
    lastTooltipSeen.current = Date.now();
  }

  // --- FERMETURE TOOLTIP globale, la plus robuste ---
  useEffect(() => {
    function handleWindowBlurOrMouseOut(e) {
      if (!e.relatedTarget || e.type === "blur") {
        setTooltip((tt) => (tt.show ? { ...tt, show: false } : tt));
      }
    }
    window.addEventListener("mouseout", handleWindowBlurOrMouseOut);
    window.addEventListener("blur", handleWindowBlurOrMouseOut);
    return () => {
      window.removeEventListener("mouseout", handleWindowBlurOrMouseOut);
      window.removeEventListener("blur", handleWindowBlurOrMouseOut);
    };
  }, []);

  const [focusValue, setFocusValue] = useState(null);

  // Responsive
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 600 });
  useEffect(() => {
    function handleResize() {
      if (!containerRef.current) return;
      const width = containerRef.current.offsetWidth || 1200;
      const height = containerRef.current.clientHeight || 400;
      setContainerSize({ width: Math.max(0, width), height: Math.max(0, height) });
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
  const { width, height } = containerSize;

  // Slider
  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;
    function setProgress() {
      const value = Number(el.value);
      const min = Number(el.min);
      const max = Number(el.max);
      const percent = ((value - min) / (max - min)) * 100;
      el.style.setProperty("--progress", `${percent}%`);
    }
    setProgress();
    el.addEventListener("input", setProgress);
    return () => el.removeEventListener("input", setProgress);
  }, [years, animValue]);

  const [unselectingRegions, setUnselectingRegions] = useState([]);

  // Per capita
  const isPerCapita =
    Array.isArray(data) && data.length && d3.max(data, d => d.gdp) !== undefined
      ? d3.max(data, d => d.gdp) < 5_000_000
      : false;

  function formatValue(val) {
    if (isPerCapita) {
      return "$" + formatNumberSpace(Math.round(val));
    } else {
      return "$" + formatNumberSpace(Math.round(val / 1e9)) + "B";
    }
  }

  function getHierarchy(
    data,
    year,
    selectedRegions,
    freeForAll = false
  ) {
    const regionsToShow = selectedRegions;
    const currentYearData = data.filter(
      (d) =>
        d.year === year &&
        d.gdp &&
        d.gdp > 0 &&
        d.region &&
        d.region !== "Other" &&
        regionsToShow.includes(d.region)
    );
    if (freeForAll) {
      return {
        name: "World",
        children: currentYearData.map((d) => ({
          name: d.country,
          value: d.gdp,
          region: d.region,
        })),
      };
    }
    const regions = d3.group(currentYearData, (d) => d.region);
    const regionsArr = Array.from(regions, ([region, countries]) => ({
      name: region,
      children: countries.map((d) => ({
        name: d.country,
        value: d.gdp,
        region: d.region,
      })),
    }));
    return { name: "World", children: regionsArr };
  }

  // POLICE MINIMUM TRES PETITE
  function getFontSize(area, maxFont = 24, minFont = 2) {
    return Math.max(minFont, Math.min(maxFont, Math.sqrt(area) / 5));
  }

  const safeSelectedRegions =
    !selectedRegions || selectedRegions.length === 0
      ? REGION_LIST.filter((r) => r !== "Other")
      : selectedRegions.filter((r) => r !== "Other");

  // Animation
  const playingRef = useRef(playing);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  useEffect(() => {
    if (!playing || years.length === 0) return;
    let animating = true;
    const tick = () => {
      onYearChange((prev) => {
        if (!playingRef.current || !animating) return prev;
        const idx = years.findIndex((y) => y >= Math.floor(prev));
        if (idx < years.length - 1) {
          const target = years[idx + 1];
          if (prev < target) {
            const next = Math.min(prev + 0.02, target);
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
  }, [playing, years, onYearChange, setPlaying]);

  function handleCountryFocus(country) {
    setCountryFocus(country);
    setFocusRerender(v => v + 1);
  }

  function handleFreeForAllClick() {
    if (freeForAll) {
      setSelectedRegions(null);
    }
    setFreeForAll(true);
  }
  function handleWorldClick() {
    if (!freeForAll) {
      setSelectedRegions(null);
    }
    setFreeForAll(false);
  }
  function handleRegionToggle(region) {
    if (region === "Other") return;
    const wasPlaying = playing;
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
    if (wasPlaying) setTimeout(() => setPlaying(true), 0);
  }
  function handleRegionClick(region) {
    if (region === "Other") return;
    const wasPlaying = playing;
    setSelectedRegions((current) => {
      if (!current || current === null) return [region];
      if (current.includes(region)) return current;
      return [...current, region];
    });
    if (wasPlaying) setTimeout(() => setPlaying(true), 0);
  }

  // Rendu D3
  useEffect(() => {
    if (!svgRef.current || !Array.isArray(data) || data.length === 0 || years.length === 0) return;
    const y1 = Math.floor(animValue);
    const y2 = Math.ceil(animValue);
    const t = animValue - y1;
    const regionsArray = safeSelectedRegions;

    const y1Clamped = Math.max(years[0], Math.min(years[years.length - 1], y1));
    const y2Clamped = Math.max(years[0], Math.min(years[years.length - 1], y2));
    const PADDING_TOP = 0;
    const PADDING_INNER = 3;
    const PADDING_OUTER = 3;

    let k1 = 1, k2 = 1;
    if (proportional) {
      const maxTotal =
        d3.max(years, (y) => {
          const arr = data.filter(
            (d) =>
              d.year === y &&
              d.gdp &&
              d.gdp > 0 &&
              d.region &&
              d.region !== "Other" &&
              regionsArray.includes(d.region)
          );
          return d3.sum(arr, (d) => d.gdp);
        }) || 1;
      const total1 = d3.sum(
        data.filter(
          (d) =>
            d.year === y1Clamped &&
            d.gdp &&
            d.gdp > 0 &&
            d.region &&
            d.region !== "Other" &&
            regionsArray.includes(d.region)
        ),
        (d) => d.gdp
      );
      const total2 = d3.sum(
        data.filter(
          (d) =>
            d.year === y2Clamped &&
            d.gdp &&
            d.gdp > 0 &&
            d.region &&
            d.region !== "Other" &&
            regionsArray.includes(d.region)
        ),
        (d) => d.gdp
      );
      k1 = Math.sqrt(total1 / maxTotal);
      k2 = Math.sqrt(total2 / maxTotal);
    }

    const h1 = d3
      .hierarchy(getHierarchy(data, y1Clamped, regionsArray, freeForAll))
      .sum((d) => d.value || 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    const h2 = d3
      .hierarchy(getHierarchy(data, y2Clamped, regionsArray, freeForAll))
      .sum((d) => d.value || 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    d3
      .treemap()
      .size([width * k1, height * k1])
      .paddingInner(PADDING_INNER)
      .paddingOuter(PADDING_OUTER)
      .paddingTop((d) => (!freeForAll && d.height === 1 ? PADDING_TOP : 0))(h1);
    d3
      .treemap()
      .size([width * k2, height * k2])
      .paddingInner(PADDING_INNER)
      .paddingOuter(PADDING_OUTER)
      .paddingTop((d) => (!freeForAll && d.height === 1 ? PADDING_TOP : 0))(h2);

    h1.each((d) => {
      d.x0 += ((1 - k1) / 2) * width;
      d.x1 += ((1 - k1) / 2) * width;
      d.y0 += ((1 - k1) / 2) * height;
      d.y1 += ((1 - k1) / 2) * height;
    });
    h2.each((d) => {
      d.x0 += ((1 - k2) / 2) * width;
      d.x1 += ((1 - k2) / 2) * width;
      d.y0 += ((1 - k2) / 2) * height;
      d.y1 += ((1 - k2) / 2) * height;
    });

    const m1 = new Map();
    if (h1.leaves) h1.leaves().forEach((d) => {
      m1.set((d.parent?.data.name ?? "") + "|" + d.data.name, d);
    });
    const m2 = new Map();
    if (h2.leaves) h2.leaves().forEach((d) => {
      m2.set((d.parent?.data.name ?? "") + "|" + d.data.name, d);
    });

    const leaves = Array.from(new Set([...m1.keys(), ...m2.keys()]));
    const nodes = leaves
      .map((key) => {
        const a = m1.get(key);
        const b = m2.get(key);
        if (!a && !b) return null;
        const x0 = a && b ? (1 - t) * a.x0 + t * b.x0 : a ? a.x0 : b.x0;
        const x1 = a && b ? (1 - t) * a.x1 + t * b.x1 : a ? a.x1 : b.x1;
        const y0 = a && b ? (1 - t) * a.y0 + t * b.y0 : a ? a.y0 : b.y0;
        const y1 = a && b ? (1 - t) * a.y1 + t * b.y1 : a ? a.y1 : b.y1;
        const value =
          a && b ? (1 - t) * a.value + t * b.value : a ? a.value : b.value;
        const region = (a && a.data.region) || (b && b.data.region);
        const [_, country] = key.split("|");
        return { x0, x1, y0, y1, value, region, country };
      })
      .filter(Boolean);

    // --- Focus Country GDP value live ---
    if (countryFocus) {
      const focusNode = nodes.find((d) => d.country === countryFocus);
      setFocusValue(focusNode ? focusNode.value : null);
    } else {
      setFocusValue(null);
    }

    // SVG rendering
    const svg = d3
      .select(svgRef.current)
      .attr("viewBox", `0 -30 ${width} ${height + 50}`)
      .attr("width", width)
      .attr("height", height + 50)
      .attr("key", countryFocus + "-" + focusRerender);

    svg.selectAll("*").remove();

    svg
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "transparent")
      .lower();

    const regionNodes = h1.children || [];
    const regionLabelData = regionNodes.map((regionNode) => {
      const regionWidth = regionNode.x1 - regionNode.x0;
      const regionHeight = regionNode.y1 - regionNode.y0;
      const regionArea = regionWidth * regionHeight;
      return {
        name: regionNode.data.name,
        x0: regionNode.x0,
        y0: regionNode.y0,
        x1: regionNode.x1,
        y1: regionNode.y1,
        width: regionWidth,
        area: regionArea,
        subtotal: regionNode.value ? formatValue(regionNode.value) : "",
        fontSize: getFontSize(regionArea),
      };
    });
    const regionFontSizeMap = {};
    for (const r of regionLabelData) {
      regionFontSizeMap[r.name] = r.fontSize;
    }

    // Définition defs pour clip et filtre ombre
    const defs = svg.append("defs");

    const group = svg.append("g").attr("class", "treemap");
    group
      .selectAll("g")
      .data(nodes, (d) => d.region + "|" + d.country)
      .join("g")
      .attr("transform", (d) => `translate(${Math.round(d.x0)},${Math.round(d.y0)})`)
      .each(function (d) {
        const g = d3.select(this);
        const isFocused = countryFocus && d.country === countryFocus;
        const w = Math.max(0, Math.round(d.x1 - d.x0));
        const h = Math.max(0, Math.round(d.y1 - d.y0));
        const baseColor = isFocused ? "#FA003F" : regionColors(d.region);

        // Rect principal
        g.append("rect")
          .attr("width", w)
          .attr("height", h)
          .attr("fill", baseColor)
          .attr("stroke", isFocused ? "#FF4D7D" : "rgba(255,255,255,0.10)")
          .attr("stroke-width", isFocused ? 2 : 1)
          .attr("cursor", "pointer")
          .on("click", function () {
            handleCountryFocus(d.country);
          })
          .on("mousemove", function (event) {
            setTooltip({
              show: true,
              x: event.clientX,
              y: event.clientY,
              name: d.country,
              value: d.value,
            });
            touchTooltip();
          })
          .on("mouseleave", function () {
            setTooltip((tt) => tt.show ? { ...tt, show: false } : tt);
          });

        // Overlay gradient pour profondeur (seulement si assez grand)
        if (w > 20 && h > 20) {
          const gradId = `grad-${(d.region + d.country).replace(/[^a-zA-Z0-9]/g, "_")}`;
          const grad = defs.append("linearGradient")
            .attr("id", gradId)
            .attr("x1", "0%").attr("y1", "0%")
            .attr("x2", "0%").attr("y2", "100%");
          grad.append("stop").attr("offset", "0%").attr("stop-color", "rgba(255,255,255,0.12)");
          grad.append("stop").attr("offset", "100%").attr("stop-color", "rgba(0,0,0,0.12)");

          g.append("rect")
            .attr("width", w)
            .attr("height", h)
            .attr("fill", `url(#${gradId})`)
            .attr("pointer-events", "none");
        }

        const area = w * h;
        const maxFont = regionFontSizeMap[d.region] || 22;
        const fontSize = getFontSize(area, maxFont);

        // Labels pays
        if (w > 28 && h > 14) {
          const labelGroup = g.append("g")
            .attr("pointer-events", "none");

          // Nom du pays
          const nameFontSize = Math.max(3, fontSize * 0.85);
          labelGroup.append("text")
            .attr("x", 5)
            .attr("y", nameFontSize + 3)
            .attr("font-size", nameFontSize)
            .attr("font-family", "Inter, Arial, sans-serif")
            .attr("fill", "#fff")
            .attr("fill-opacity", isFocused ? 1 : 0.92)
            .attr("font-weight", isFocused ? 600 : 400)
            .attr("letter-spacing", nameFontSize > 9 ? "0.02em" : "0em")
            .text(
              d.country.length < 18
                ? d.country.toUpperCase()
                : d.country.slice(0, 17).toUpperCase() + "…"
            );

          // Valeur GDP (seulement si assez de place)
          if (d.value && h > nameFontSize * 2.5) {
            const valFontSize = Math.max(3, fontSize * 0.70);
            labelGroup.append("text")
              .attr("x", 5)
              .attr("y", nameFontSize + valFontSize + 5)
              .attr("font-size", valFontSize)
              .attr("font-family", "Inter, Arial, sans-serif")
              .attr("fill", "#fff")
              .attr("fill-opacity", isFocused ? 0.95 : 0.72)
              .attr("font-weight", 300)
              .attr("letter-spacing", "0.04em")
              .text(formatValue(d.value));
          }
        }
      });
  }, [
    data,
    animValue,
    years,
    selectedRegions,
    countryFocus,
    focusRerender,
    freeForAll,
    proportional,
    width,
    height,
    setCountryFocus,
    setPlaying,
    formatValue,
    playing,
  ]);

  // Contrôles
  const selectedArr = Array.isArray(selectedRegions) ? selectedRegions : [];
  const [countryList, setCountryList] = useState([]);
  useEffect(() => {
    setCountryList(
      data
        .filter((d) => d.region && d.region !== "Other" && years.includes(d.year))
        .map((d) => d.country)
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .sort()
    );
  }, [data, years]);

  const roundedYear = Math.round(animValue);

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

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center gap-4 w-full"
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
            color: regionColors(
              (data.find((d: any) => d.country === tooltip.name)?.region) || ""
            ),
            marginBottom: 4,
            opacity: 0.9,
          }}>
            {data.find((d: any) => d.country === tooltip.name)?.region || ""}
          </span>
          <span
            style={{
              fontWeight: 500,
              fontSize: 15,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: 4,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              color: "#fff",
            }}
          >
            {tooltip.name}
          </span>
          <span
            style={{
              fontWeight: 300,
              fontSize: 14,
              opacity: 0.85,
              whiteSpace: "nowrap",
              lineHeight: 1.2,
              color: "#a8d8ea",
              letterSpacing: "0.02em",
            }}
          >
            {tooltip.value !== null ? formatValue(tooltip.value) : "—"}
          </span>
        </div>
      )}

      {/* Boutons multi/single sélection */}
      <div className="flex flex-wrap gap-3 justify-center p-4 rounded-2xl">
        <button
          onClick={handleFreeForAllClick}
          className={`region-btn${freeForAll ? " region-btn--active" : ""}`}
          style={freeForAll ? { background: "#555", color: "#fff" } : {}}
        >
          Free for all
        </button>
        <button
          onClick={handleWorldClick}
          className={`region-btn${!freeForAll ? " region-btn--active" : ""}`}
        >
          🌍 World
        </button>
        {REGION_LIST.filter((region) => region !== "Other").map((region) => {
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

      {/* Contrôles animation alignés */}
      <div
        className="center-controls-wrapper flex items-center gap-4 w-full"
        style={{
          minWidth: 300,
          maxWidth: 1280,
          margin: "0 auto",
          padding: "6px 0",
          fontSize: 13,
          lineHeight: "1.2",
        }}
      >
        {/* Année + Métrique — grand espace à gauche */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1, minWidth: 80, flexShrink: 0 }}>
          <span style={{
            fontSize: "2rem",
            fontWeight: 800,
            color: "rgba(255,255,255,0.85)",
            fontFamily: "Inter, Arial, sans-serif",
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}>
            {Math.round(animValue)}
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
            step={0.01}
            value={animValue}
            onChange={(e) => {
              setPlaying(false);
              onYearChange(Math.round(Number(e.target.value)));
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
        {/* Année */}
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
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        {/* Focus Country + PIB + Clear + Proportional */}
        <div className="flex flex-row items-center min-w-[250px] ml-2" style={{ marginTop: 0 }}>
          <select
            id="countryFocus"
            value={countryFocus ?? ""}
            onChange={(e) => handleCountryFocus(e.target.value || null)}
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
              {focusValue !== null ? formatValue(focusValue) : "—"}
            </span>
          )}
          {countryFocus && (
            <button
              onClick={() => handleCountryFocus(null)}
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
          <select
            id="proportionalSelect"
            value={proportional ? "proportional" : "non-proportional"}
            onChange={(e) => setProportional(e.target.value === "proportional")}
            className="select-glass px-2 py-1 min-w-[75px]"
            style={{
              fontSize: 13,
              padding: "2px 8px",
              marginLeft: 12,
            }}
            title="Choose proportional sizing mode"
          >
            <option value="proportional">Proportional</option>
            <option value="non-proportional">Non prop.</option>
          </select>
        </div>
      </div>
      {/* SVG */}
      <div
        className="w-full overflow-x-auto"
        style={{ flex: 1, minHeight: 0, alignItems: "stretch" }}
        onMouseLeave={() => setTooltip((tt) => tt.show ? { ...tt, show: false } : tt)}
      >
        <svg
          ref={svgRef}
          width={width}
          height={height}
          key={countryFocus + "-" + focusRerender}
          style={{
            display: "block",
            minWidth: 360,
            minHeight: 320,
            maxWidth: "100%",
            maxHeight: "100%",
          }}
          onMouseLeave={() => setTooltip((tt) => tt.show ? { ...tt, show: false } : tt)}
        ></svg>
      </div>
    </div>
  );
}
