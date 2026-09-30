import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

type BreakpointSize = number | { xs?: number; sm?: number; md?: number; lg?: number; xl?: number };

export default function ResponsiveGrid({ container, spacing = 0, size, children }: { container?: boolean; spacing?: number; size?: BreakpointSize; children: ReactNode }) {
  if (container) {
    return <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: spacing }}>{children}</Box>;
  }
  const spans = typeof size === 'number' ? { xs: size } : (size ?? { xs: 12 });
  return <Box sx={{ gridColumn: { xs: `span ${spans.xs ?? 12}`, sm: `span ${spans.sm ?? spans.xs ?? 12}`, md: `span ${spans.md ?? spans.sm ?? spans.xs ?? 12}`, lg: `span ${spans.lg ?? spans.md ?? spans.sm ?? spans.xs ?? 12}`, xl: `span ${spans.xl ?? spans.lg ?? spans.md ?? spans.sm ?? spans.xs ?? 12}` } }}>{children}</Box>;
}
