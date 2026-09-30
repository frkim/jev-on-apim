'use client';

import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import SearchIcon from '@mui/icons-material/Search';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@/components/ResponsiveGrid';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { sampleCategories, samples } from '@/samples';
import { setEvaluateHandoff, setPlaygroundHandoff } from '@/lib/storage';

export default function SamplesPage() {
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const router = useRouter();
  const filtered = useMemo(() => samples.filter((sample) => {
    const matchesCategory = category === 'All' || sample.category === category;
    const text = `${sample.title} ${sample.description} ${sample.patterns.join(' ')}`.toLowerCase();
    return matchesCategory && text.includes(query.toLowerCase());
  }), [category, query]);

  return (
    <Stack spacing={3}>
      <Box><Typography variant="h3" gutterBottom>Samples</Typography><Typography color="text.secondary">Realistic Jev decision templates with labelled evaluation data.</Typography></Box>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        {['All', ...sampleCategories].map((item) => <Chip key={item} label={item} color={category === item ? 'primary' : 'default'} onClick={() => setCategory(item)} />)}
      </Stack>
      <TextField label="Search samples" value={query} onChange={(e) => setQuery(e.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }} />
      <Grid container spacing={3}>
        {filtered.map((sample) => (
          <Grid key={sample.id} size={{ xs: 12, md: 6, xl: 4 }}>
            <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flex: 1 }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><AutoGraphIcon color="primary" /><Typography variant="h5">{sample.title}</Typography></Stack>
                  <Typography color="text.secondary">{sample.description}</Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}><Chip label={sample.category} size="small" />{sample.patterns.map((tag) => <Chip key={tag} label={tag} size="small" variant="outlined" />)}</Stack>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>{Object.values(sample.questions).map((q, i) => <Chip key={`${q.type}-${i}`} label={q.type} size="small" color="secondary" variant="outlined" />)}</Stack>
                  <Typography variant="body2">{sample.testCases.length} labelled test cases</Typography>
                </Stack>
              </CardContent>
              <CardActions>
                <Button onClick={() => { setPlaygroundHandoff({ state: sample.state, questions: sample.questions, model: sample.model }); router.push('/'); }}>Open in Playground</Button>
                <Button variant="contained" onClick={() => { setEvaluateHandoff({ sampleId: sample.id }); router.push('/evaluate'); }}>Evaluate</Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
