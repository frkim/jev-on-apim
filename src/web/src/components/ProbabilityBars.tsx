'use client';

import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function ProbabilityBars({ probabilities, highlight }: { probabilities: Record<string, number>; highlight?: string }) {
  const entries = Object.entries(probabilities).sort((a, b) => b[1] - a[1]);
  return (
    <Stack spacing={1}>
      {entries.map(([key, value]) => (
        <Box key={key} aria-label={`${key} probability ${(value * 100).toFixed(1)} percent`}>
          <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ fontWeight: highlight === key ? 800 : 500 }}>{key}</Typography>
            <Typography variant="body2" color="text.secondary">{(value * 100).toFixed(1)}%</Typography>
          </Stack>
          <LinearProgress variant="determinate" value={Math.max(0, Math.min(100, value * 100))} color={highlight === key ? 'primary' : 'secondary'} sx={{ height: 10, borderRadius: 999 }} />
        </Box>
      ))}
    </Stack>
  );
}
