"use client";

import React, { useRef, useEffect } from "react";
import * as d3 from "d3";

const width = 700;
const height = 700;
const innerRadius = Math.min(width, height) * 0.4;
const outerRadius = innerRadius + 10;

// Exemple de données - matrice carrée
const matrix = [
  [11975, 5871, 8916, 2868],
  [1951, 10048, 2060, 6171],
  [8010, 16145, 8090, 8045],
  [1013, 990,  940, 6907]
];

// Groupes noms
const names = ["A", "B", "C", "D"];

export default function ChordDiagram() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Crée le layout chord
    const chord = d3.chord()
      .padAngle(0.05)
      .sortSubgroups(d3.descending);

    const chords = chord(matrix);

    // Générateur d'arcs pour les groupes
    const arc = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius);

    // Générateur de liens (ribbons)
    const ribbon = d3.ribbon()
      .radius(innerRadius);

    // Couleur par groupe
    const color = d3.scaleOrdinal()
      .domain(d3.range(names.length))
      .range(d3.schemeCategory10);

    // Groupe principal pour centrer le diagramme
    const g = svg
      .attr("viewBox", [0, 0, width, height])
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    // Dessine les liens
    g.append("g")
      .attr("fill-opacity", 0.7)
      .selectAll("path")
      .data(chords)
      .join("path")
      .attr("d", ribbon)
      .attr("fill", d => color(d.target.index))
      .attr("stroke", d => d3.rgb(color(d.target.index)).darker());

    // Dessine les arcs (groupes)
    const group = g.append("g")
      .selectAll("g")
      .data(chords.groups)
      .join("g");

    group.append("path")
      .attr("fill", d => color(d.index))
      .attr("stroke", d => d3.rgb(color(d.index)).darker())
      .attr("d", arc);

    // Ajoute labels
    group.append("text")
      .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
      .attr("dy", "0.35em")
      .attr("transform", d => `
        rotate(${(d.angle * 180 / Math.PI - 90)})
        translate(${outerRadius + 5})
        ${d.angle > Math.PI ? "rotate(180)" : ""}
      `)
      .attr("text-anchor", d => d.angle > Math.PI ? "end" : "start")
      .text(d => names[d.index])
      .style("font-family", "sans-serif")
      .style("font-size", 14);

  }, []);

  return <svg ref={svgRef}></svg>;
}
