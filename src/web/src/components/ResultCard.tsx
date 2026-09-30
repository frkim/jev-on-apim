'use client';

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlineOutlined';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { Answer } from '@/lib/jev';
import { answerConfidence } from '@/lib/jev';
import { ProbabilityBars } from './ProbabilityBars';

export function ResultCard({ id, answer, threshold }: { id: string; answer: Answer; threshold: number }) {
  const confidence = answerConfidence(answer);
  const accepted = confidence >= threshold;
  return (
    <Card variant="outlined" component="article" aria-label={`Result for ${id}`}>
      <CardContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, mb: 2 }}>
          <Typography variant="h6">{id}</Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Chip label={answer.type} size="small" />
            <Chip icon={accepted ? <CheckCircleIcon /> : <HelpOutlineIcon />} color={accepted ? 'success' : 'warning'} label={accepted ? 'auto-accept' : 'needs review'} size="small" />
            <Chip label={`confidence ${(confidence * 100).toFixed(1)}%`} size="small" />
          </Stack>
        </Stack>
        {answer.type === 'noul' && (
          <Box>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}><Typography sx={{ fontWeight: 800 }}>{answer.noul >= 0.5 ? 'YES' : 'NO'}</Typography><Typography>{(answer.noul * 100).toFixed(1)}% P(yes)</Typography></Stack>
            <LinearProgress variant="determinate" value={answer.noul * 100} sx={{ height: 18, borderRadius: 999, my: 1 }} aria-label="Probability of yes" />
            <Typography variant="caption" color="text.secondary">Decision boundary: 50%</Typography>
          </Box>
        )}
        {answer.type === 'choice' && <ProbabilityBars probabilities={answer.probabilities} highlight={answer.choice} />}
        {answer.type === 'score' && (
          <Stack spacing={2}>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>Score {answer.score.toFixed(2)}</Typography>
            <Slider aria-label="Score value" value={answer.score} min={0} max={Math.max(1, Object.keys(answer.legend).length - 1)} step={0.01} marks={Object.entries(answer.legend).map(([value, label]) => ({ value: Number(value), label }))} valueLabelDisplay="auto" disabled />
            <ProbabilityBars probabilities={answer.probabilities} />
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
