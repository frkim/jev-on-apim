'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import * as d3 from 'd3';
import { useEffect, useMemo, useRef } from 'react';
import type { CoverageAccuracyPoint } from '@/lib/jev';

export function CoverageChart({ points, currentThreshold }: { points: CoverageAccuracyPoint[]; currentThreshold: number }) {
  const ref = useRef<SVGSVGElement | null>(null);
  const current = useMemo(() => points.find((point) => Math.abs(point.threshold - currentThreshold) < 0.006), [points, currentThreshold]);

  useEffect(() => {
    const svg = d3.select(ref.current);
    svg.selectAll('*').remove();
    const width = 640;
    const height = 360;
    const margin = { top: 24, right: 24, bottom: 48, left: 58 };
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', 'Coverage accuracy curve');
    const x = d3.scaleLinear().domain([0, 1]).range([margin.left, width - margin.right]);
    const y = d3.scaleLinear().domain([0, 1]).range([height - margin.bottom, margin.top]);
    const valid = points.filter((point) => point.accuracy !== null);
    const line = d3.line<CoverageAccuracyPoint>().x((point) => x(point.coverage)).y((point) => y(point.accuracy ?? 0)).curve(d3.curveMonotoneX);
    svg.append('g').attr('transform', `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).tickFormat(d3.format('.0%')));
    svg.append('g').attr('transform', `translate(${margin.left},0)`).call(d3.axisLeft(y).tickFormat(d3.format('.0%')));
    svg.append('text').attr('x', width / 2).attr('y', height - 8).attr('text-anchor', 'middle').attr('fill', 'currentColor').text('Coverage');
    svg.append('text').attr('transform', 'rotate(-90)').attr('x', -height / 2).attr('y', 18).attr('text-anchor', 'middle').attr('fill', 'currentColor').text('Accuracy');
    svg.append('path').datum(valid).attr('fill', 'none').attr('stroke', '#2454d6').attr('stroke-width', 3).attr('d', line);
    const tooltip = d3.select('body').append('div').style('position', 'fixed').style('pointer-events', 'none').style('background', 'rgba(15,23,42,.92)').style('color', 'white').style('padding', '8px 10px').style('border-radius', '8px').style('font-size', '12px').style('opacity', 0);
    svg.selectAll('circle.point').data(valid).join('circle').attr('class', 'point').attr('cx', (point) => x(point.coverage)).attr('cy', (point) => y(point.accuracy ?? 0)).attr('r', (point) => Math.abs(point.threshold - currentThreshold) < 0.006 ? 6 : 3).attr('fill', (point) => Math.abs(point.threshold - currentThreshold) < 0.006 ? '#d97706' : '#2454d6').on('mousemove', (event, point) => {
      tooltip.style('opacity', 1).style('left', `${event.clientX + 12}px`).style('top', `${event.clientY + 12}px`).html(`threshold ${(point.threshold * 100).toFixed(0)}%<br/>coverage ${(point.coverage * 100).toFixed(1)}%<br/>accuracy ${((point.accuracy ?? 0) * 100).toFixed(1)}%`);
    }).on('mouseleave', () => tooltip.style('opacity', 0));
    return () => { tooltip.remove(); };
  }, [points, currentThreshold]);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>Coverage–accuracy curve</Typography>
      <svg ref={ref} style={{ width: '100%', maxWidth: 720 }} />
      {current && <Typography variant="body2" color="text.secondary">At threshold {(currentThreshold * 100).toFixed(0)}%: {(current.coverage * 100).toFixed(1)}% coverage, {current.accuracy === null ? 'n/a' : `${(current.accuracy * 100).toFixed(1)}%`} accuracy.</Typography>}
    </Box>
  );
}
