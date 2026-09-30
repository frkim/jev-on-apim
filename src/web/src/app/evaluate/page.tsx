'use client';

import DownloadIcon from '@mui/icons-material/Download';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import Grid from '@/components/ResponsiveGrid';
import InputLabel from '@mui/material/InputLabel';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { DataGrid, GridToolbar, type GridColDef } from '@mui/x-data-grid';
import { useEffect, useMemo, useRef, useState } from 'react';
import { invokeSystemOne } from '@/lib/api';
import type { Answer, ExpectedValue, JevRequest, QuestionMap } from '@/lib/jev';
import { answerConfidence, coverageAccuracyCurve, estimateInputCost, formatUsd, isCorrect, percentile, predictedValue, scoreAbsoluteError, validateQuestions } from '@/lib/jev';
import { loadSettings, takeEvaluateHandoff } from '@/lib/storage';
import { CoverageChart } from '@/components/CoverageChart';
import { samples, type SampleDefinition, type SampleTestCase } from '@/samples';

type Dataset = { questions: QuestionMap; model?: string; testCases: SampleTestCase[] };
type ResultRow = { id: string; caseName: string; questionId: string; expected: ExpectedValue; predicted: ExpectedValue | string; confidence: number; correct: boolean; latencyMs: number; inputTokens: number; outputTokens: number; error?: string; answer?: Answer };

const columns: GridColDef<ResultRow>[] = [
  { field: 'caseName', headerName: 'Case', flex: 1, minWidth: 160 },
  { field: 'questionId', headerName: 'Question', flex: 1, minWidth: 140 },
  { field: 'expected', headerName: 'Expected', flex: 1, minWidth: 120 },
  { field: 'predicted', headerName: 'Predicted', flex: 1, minWidth: 120 },
  { field: 'confidence', headerName: 'Confidence', type: 'number', valueFormatter: (value: number) => `${(value * 100).toFixed(1)}%`, width: 130 },
  { field: 'correct', headerName: 'Correct', type: 'boolean', width: 110 },
  { field: 'latencyMs', headerName: 'Latency ms', type: 'number', width: 130 },
  { field: 'error', headerName: 'Error', flex: 1, minWidth: 200 },
];

export default function EvaluatePage() {
  const [selectedSampleId, setSelectedSampleId] = useState(samples[0].id);
  const [customJson, setCustomJson] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [model, setModel] = useState('jev-latest');
  const [concurrency, setConcurrency] = useState(3);
  const [timeoutSec, setTimeoutSec] = useState(30);
  const [retries, setRetries] = useState(2);
  const [threshold, setThreshold] = useState(0.8);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const settings = loadSettings();
    setModel(settings.defaultModel);
    setConcurrency(settings.concurrency);
    setTimeoutSec(settings.timeoutSec);
    setRetries(settings.retries);
    setThreshold(settings.confidenceThreshold);
    const handoff = takeEvaluateHandoff<{ sampleId: string }>();
    if (handoff?.sampleId) setSelectedSampleId(handoff.sampleId);
  }, []);

  const selectedSample = samples.find((sample) => sample.id === selectedSampleId) ?? samples[0];
  const datasetResult = useMemo(() => parseDataset(useCustom, customJson, selectedSample), [useCustom, customJson, selectedSample]);
  const dataset = datasetResult.dataset;
  const totalCalls = (dataset?.testCases.length ?? 0);
  const progress = totalCalls ? (completed / totalCalls) * 100 : 0;
  const settings = typeof window === 'undefined' ? null : loadSettings();

  const metricRows = rows.filter((row) => !row.error).map((row) => ({ confidence: row.confidence, correct: row.correct }));
  const curve = coverageAccuracyCurve(metricRows);
  const accepted = metricRows.filter((row) => row.confidence >= threshold);
  const accuracy = metricRows.length ? metricRows.filter((row) => row.correct).length / metricRows.length : 0;
  const acceptedAccuracy = accepted.length ? accepted.filter((row) => row.correct).length / accepted.length : 0;
  const latencies = rows.filter((row) => !row.error).map((row) => row.latencyMs);
  const totalInput = rows.reduce((sum, row) => sum + row.inputTokens, 0);
  const totalOutput = rows.reduce((sum, row) => sum + row.outputTokens, 0);
  const scoreErrors = rows.map((row) => row.answer ? scoreAbsoluteError(row.answer, row.expected) : null).filter((value): value is number => value !== null);

  async function runAll() {
    if (!dataset) return;
    setRows([]);
    setCompleted(0);
    setRunning(true);
    setError(null);
    const abort = new AbortController();
    abortRef.current = abort;
    const queue = [...dataset.testCases.entries()];
    const out: ResultRow[] = [];
    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length && !abort.signal.aborted) {
        const next = queue.shift();
        if (!next) break;
        const [caseIndex, testCase] = next;
        const started = performance.now();
        const request: JevRequest = { model: model || dataset.model || 'jev-latest', state: testCase.state, questions: dataset.questions };
        try {
          const response = await invokeSystemOne({ baseUrl: settings?.apiBaseUrl, request, timeoutSec, retries, signal: abort.signal });
          const latency = response.meta.latencyMs ?? Math.round(performance.now() - started);
          for (const [questionId, expected] of Object.entries(testCase.expected)) {
            const answer = response.result.answers[questionId];
            if (!answer) continue;
            out.push({ id: `${caseIndex}-${questionId}`, caseName: testCase.name, questionId, expected, predicted: predictedValue(answer), confidence: answerConfidence(answer), correct: isCorrect(answer, expected), latencyMs: latency, inputTokens: response.result.usage.input_tokens, outputTokens: response.result.usage.output_tokens, answer });
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'API unreachable';
          for (const questionId of Object.keys(testCase.expected)) out.push({ id: `${caseIndex}-${questionId}`, caseName: testCase.name, questionId, expected: testCase.expected[questionId], predicted: 'error', confidence: 0, correct: false, latencyMs: Math.round(performance.now() - started), inputTokens: 0, outputTokens: 0, error: message });
        } finally {
          setRows([...out]);
          setCompleted((value) => value + 1);
        }
      }
    });
    await Promise.all(workers);
    setRows([...out]);
    setRunning(false);
    abortRef.current = null;
  }

  return (
    <Stack spacing={3}>
      <Box><Typography variant="h3" gutterBottom>Evaluate</Typography><Typography color="text.secondary">Batch run labelled test cases and inspect accuracy, threshold coverage, latency, and cost.</Typography></Box>
      {datasetResult.error && <Alert severity="error">{datasetResult.error}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      <Card variant="outlined"><CardContent><Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}><FormControl fullWidth><InputLabel id="sample-label">Sample</InputLabel><Select labelId="sample-label" label="Sample" value={selectedSampleId} onChange={(e) => setSelectedSampleId(e.target.value)} disabled={useCustom}>{samples.map((sample) => <MenuItem key={sample.id} value={sample.id}>{sample.title}</MenuItem>)}</Select></FormControl></Grid>
        <Grid size={{ xs: 12, md: 2 }}><TextField label="Model" value={model} onChange={(e) => setModel(e.target.value)} fullWidth /></Grid>
        <Grid size={{ xs: 6, md: 2 }}><TextField label="Concurrency" type="number" value={concurrency} onChange={(e) => setConcurrency(Math.max(1, Math.min(8, Number(e.target.value))))} fullWidth /></Grid>
        <Grid size={{ xs: 6, md: 2 }}><TextField label="Timeout" type="number" value={timeoutSec} onChange={(e) => setTimeoutSec(Number(e.target.value))} fullWidth /></Grid>
        <Grid size={{ xs: 6, md: 2 }}><TextField label="Retries" type="number" value={retries} onChange={(e) => setRetries(Number(e.target.value))} fullWidth /></Grid>
        <Grid size={{ xs: 12, md: 6 }}><Typography gutterBottom>Confidence threshold {(threshold * 100).toFixed(0)}%</Typography><Slider min={0.5} max={0.99} step={0.01} value={threshold} onChange={(_, value) => setThreshold(value as number)} /></Grid>
        <Grid size={{ xs: 12 }}><Button onClick={() => setUseCustom((value) => !value)}>{useCustom ? 'Use sample picker' : 'Paste custom dataset JSON'}</Button></Grid>
        {useCustom && <Grid size={{ xs: 12 }}><TextField label="Custom dataset JSON" value={customJson} onChange={(e) => setCustomJson(e.target.value)} multiline minRows={8} fullWidth /></Grid>}
        <Grid size={{ xs: 12 }}><Stack direction="row" spacing={1}><Button variant="contained" startIcon={<PlayArrowIcon />} disabled={running || !dataset} onClick={() => void runAll()}>Run batch</Button><Button startIcon={<StopIcon />} disabled={!running} onClick={() => abortRef.current?.abort()}>Cancel</Button><Button startIcon={<DownloadIcon />} disabled={!rows.length} onClick={() => download('jev-evaluation-results.json', JSON.stringify(rows, null, 2), 'application/json')}>Export JSON</Button><Button startIcon={<DownloadIcon />} disabled={!rows.length} onClick={() => download('jev-evaluation-results.csv', toCsv(rows), 'text/csv')}>Export CSV</Button></Stack></Grid>
        {running && <Grid size={{ xs: 12 }}><LinearProgress variant="determinate" value={progress} aria-label="Batch progress" /></Grid>}
      </Grid></CardContent></Card>
      <Grid container spacing={2}>{[
        ['Accuracy', `${(accuracy * 100).toFixed(1)}%`],
        ['Coverage @ threshold', `${(metricRows.length ? accepted.length / metricRows.length * 100 : 0).toFixed(1)}%`],
        ['Accuracy in coverage', `${(acceptedAccuracy * 100).toFixed(1)}%`],
        ['Latency p50/p95', `${percentile(latencies, .5)?.toFixed(0) ?? 'n/a'} / ${percentile(latencies, .95)?.toFixed(0) ?? 'n/a'} ms`],
        ['Tokens', `${totalInput} in / ${totalOutput} out`],
        ['Cost', formatUsd(estimateInputCost(totalInput, settings?.pricePerMillionInputUsd ?? 0.042))],
        ['Score MAE', scoreErrors.length ? (scoreErrors.reduce((a, b) => a + b, 0) / scoreErrors.length).toFixed(2) : 'n/a'],
      ].map(([label, value]) => <Grid key={label} size={{ xs: 12, sm: 6, md: 3 }}><Card variant="outlined"><CardContent><Typography color="text.secondary">{label}</Typography><Typography variant="h5">{value}</Typography></CardContent></Card></Grid>)}</Grid>
      <Card variant="outlined"><CardContent><CoverageChart points={curve} currentThreshold={threshold} /></CardContent></Card>
      <Card variant="outlined"><CardContent><Stack direction="row" spacing={1} sx={{ mb: 2 }}><Chip label={`${rows.length} rows`} /><Chip label={`${completed}/${totalCalls} cases`} /></Stack><DataGrid rows={rows} columns={columns} autoHeight pageSizeOptions={[10, 25, 50]} initialState={{ pagination: { paginationModel: { pageSize: 10 } } }} slots={{ toolbar: GridToolbar }} disableRowSelectionOnClick /></CardContent></Card>
    </Stack>
  );
}

function parseDataset(useCustom: boolean, text: string, sample: SampleDefinition): { dataset?: Dataset; error?: string } {
  if (!useCustom) return { dataset: { questions: sample.questions, model: sample.model, testCases: sample.testCases } };
  try {
    const parsed = JSON.parse(text) as Dataset;
    if (!parsed.questions || !Array.isArray(parsed.testCases)) return { error: 'Dataset requires questions and testCases.' };
    const issues = validateQuestions(parsed.questions);
    if (issues.length) return { error: issues.map((issue) => issue.message).join(' ') };
    return { dataset: parsed };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Invalid dataset JSON.' };
  }
}

function download(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: ResultRow[]): string {
  const headers = ['case', 'question', 'expected', 'predicted', 'confidence', 'correct', 'latencyMs', 'error'];
  return [headers.join(','), ...rows.map((row) => [row.caseName, row.questionId, row.expected, row.predicted, row.confidence, row.correct, row.latencyMs, row.error ?? ''].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))].join('\n');
}
