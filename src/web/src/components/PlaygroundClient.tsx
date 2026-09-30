'use client';

import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@/components/ResponsiveGrid';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';
import { invokeSystemOne } from '@/lib/api';
import type { ChoiceQuestion, JevRequest, JevSuccessResponse, Question, QuestionMap, QuestionType } from '@/lib/jev';
import { compactJson, estimateInputCost, formatUsd, MODELS, parseInstructionsInput, parseStateInput, validateQuestions } from '@/lib/jev';
import { addHistory, loadSettings, takePlaygroundHandoff } from '@/lib/storage';
import type { AppSettings } from '@/lib/storage';
import { JsonViewer } from './JsonViewer';
import { ResultCard } from './ResultCard';

type EditableQuestion = {
  id: string;
  type: QuestionType;
  instructionsMode: 'text' | 'json';
  instructionsText: string;
  noulTrue: string;
  noulFalse: string;
  choiceRows: Array<{ key: string; description: string }>;
  scoreLevels: string[];
};

const defaultState = 'Customer asks whether a refund is available for an unused subscription purchased 12 days ago.';
const defaultQuestion: EditableQuestion = {
  id: 'refund_eligible',
  type: 'noul',
  instructionsMode: 'text',
  instructionsText: 'Is the customer clearly eligible for a refund under the stated policy?',
  noulTrue: 'Meets the policy without exception handling',
  noulFalse: 'Not eligible or requires a human exception',
  choiceRows: [{ key: 'yes', description: 'Yes' }, { key: 'no', description: 'No' }],
  scoreLevels: ['not eligible', 'ambiguous', 'eligible'],
};

export function PlaygroundClient() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [stateMode, setStateMode] = useState<'text' | 'json'>('text');
  const [stateText, setStateText] = useState(defaultState);
  const [questions, setQuestions] = useState<EditableQuestion[]>([defaultQuestion]);
  const [modelMode, setModelMode] = useState<string>('jev-latest');
  const [customModel, setCustomModel] = useState('');
  const [timeoutSec, setTimeoutSec] = useState(30);
  const [retries, setRetries] = useState(2);
  const [threshold, setThreshold] = useState(0.8);
  const [showRaw, setShowRaw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<JevSuccessResponse | null>(null);
  const [lastRequest, setLastRequest] = useState<JevRequest | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
    setModelMode(MODELS.includes(loaded.defaultModel as typeof MODELS[number]) ? loaded.defaultModel : 'custom');
    setCustomModel(MODELS.includes(loaded.defaultModel as typeof MODELS[number]) ? '' : loaded.defaultModel);
    setTimeoutSec(loaded.timeoutSec);
    setRetries(loaded.retries);
    setThreshold(loaded.confidenceThreshold);
    const handoff = takePlaygroundHandoff<{ state: unknown; questions: QuestionMap; model?: string }>();
    if (handoff) {
      const isText = typeof handoff.state === 'string';
      setStateMode(isText ? 'text' : 'json');
      setStateText(isText ? String(handoff.state) : compactJson(handoff.state));
      setQuestions(Object.entries(handoff.questions).map(([id, question]) => toEditable(id, question)));
      if (handoff.model) {
        setModelMode(MODELS.includes(handoff.model as typeof MODELS[number]) ? handoff.model : 'custom');
        setCustomModel(MODELS.includes(handoff.model as typeof MODELS[number]) ? '' : handoff.model);
      }
    }
  }, []);

  const buildResult = buildRequest();
  const stateValidation = parseStateInput(stateMode, stateText);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        void run();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  function buildRequest(): { request?: JevRequest; issues: string[] } {
    const state = parseStateInput(stateMode, stateText);
    const issues: string[] = [];
    if (!state.ok) issues.push(`State: ${state.error}`);
    const map: QuestionMap = {};
    const seen = new Set<string>();
    for (const item of questions) {
      if (seen.has(item.id)) issues.push(`Question ${item.id}: duplicate id.`);
      seen.add(item.id);
      const instructions = parseInstructionsInput(item.instructionsMode, item.instructionsText);
      if (!instructions.ok) {
        issues.push(`Question ${item.id}: ${instructions.error}`);
        continue;
      }
      if (item.type === 'noul') {
        map[item.id] = { type: 'noul', instructions: instructions.value, criteria: { true: item.noulTrue || undefined, false: item.noulFalse || undefined } };
      } else if (item.type === 'choice') {
        map[item.id] = { type: 'choice', instructions: instructions.value, criteria: Object.fromEntries(item.choiceRows.filter((row) => row.key.trim()).map((row) => [row.key.trim(), row.description || null])) } satisfies ChoiceQuestion;
      } else {
        map[item.id] = { type: 'score', instructions: instructions.value, criteria: item.scoreLevels };
      }
    }
    const validation = validateQuestions(map).map((issue) => `${issue.path}: ${issue.message}`);
    issues.push(...validation);
    return state.ok && !issues.length ? { request: { model: modelMode === 'custom' ? customModel || 'jev-latest' : modelMode, state: state.value, questions: map }, issues } : { issues };
  }

  async function run() {
    if (!buildResult.request) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    setLastRequest(buildResult.request);
    const abort = new AbortController();
    abortRef.current = abort;
    const started = performance.now();
    try {
      const result = await invokeSystemOne({ baseUrl: settings.apiBaseUrl, request: buildResult.request, timeoutSec, retries, signal: abort.signal });
      setResponse(result);
      addHistory({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), request: buildResult.request, response: result, latencyMs: result.meta.latencyMs ?? Math.round(performance.now() - started), gateway: result.meta.gateway });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to reach the API. Check Settings or start the local API.';
      setError(message);
      addHistory({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), request: buildResult.request, error: message, latencyMs: Math.round(performance.now() - started) });
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function updateQuestion(index: number, patch: Partial<EditableQuestion>) {
    setQuestions((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item));
  }

  const usage = response?.result.usage;
  const cost = usage ? estimateInputCost(usage.input_tokens, settings.pricePerMillionInputUsd) : 0;
  const allScores = response && Object.values(response.result.answers).every((answer) => answer.type === 'score');
  const composite = allScores ? Object.values(response.result.answers).reduce((sum, answer) => sum + (answer.type === 'score' ? answer.score : 0), 0) / Object.keys(response.result.answers).length : null;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h3" gutterBottom>Playground</Typography>
        <Typography color="text.secondary">Build typed Jev questions, send one APIM-backed System One call, and inspect calibrated decision probabilities.</Typography>
      </Box>
      {buildResult.issues.length > 0 && <Alert severity="warning">{buildResult.issues.slice(0, 5).join(' ')}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Stack spacing={3}>
            <Card variant="outlined"><CardContent><Stack spacing={2}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}><Typography variant="h5">State</Typography><FormControlLabel control={<Switch checked={stateMode === 'json'} onChange={(e) => setStateMode(e.target.checked ? 'json' : 'text')} />} label="JSON" /></Stack>
              <TextField label="State prompt or context" value={stateText} onChange={(e) => setStateText(e.target.value)} multiline minRows={8} fullWidth error={!stateValidation.ok} helperText={stateValidation.ok ? 'Text-only Jev context, up to about 64k tokens.' : stateValidation.error} slotProps={{ htmlInput: { style: { fontFamily: 'Cascadia Mono, monospace' } } }} />
            </Stack></CardContent></Card>
            <Card variant="outlined"><CardContent><Stack spacing={2}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}><Typography variant="h5">Questions</Typography><Button startIcon={<AddIcon />} onClick={() => setQuestions((q) => [...q, { ...defaultQuestion, id: `question_${q.length + 1}` }])}>Add question</Button></Stack>
              {questions.map((question, index) => (
                <QuestionCard key={`${question.id}-${index}`} question={question} index={index} onChange={updateQuestion} onDelete={() => setQuestions((q) => q.filter((_, i) => i !== index))} onDuplicate={() => setQuestions((q) => [...q.slice(0, index + 1), { ...question, id: `${question.id}_copy` }, ...q.slice(index + 1)])} />
              ))}
            </Stack></CardContent></Card>
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Stack spacing={3}>
            <Card variant="outlined"><CardContent><Stack spacing={2}>
              <Typography variant="h5">Run parameters</Typography>
              <FormControl fullWidth><InputLabel id="model-label">Model</InputLabel><Select labelId="model-label" label="Model" value={modelMode} onChange={(e) => setModelMode(e.target.value)}>{MODELS.map((model) => <MenuItem key={model} value={model}>{model}</MenuItem>)}<MenuItem value="custom">Custom</MenuItem></Select></FormControl>
              {modelMode === 'custom' && <TextField label="Custom model" value={customModel} onChange={(e) => setCustomModel(e.target.value)} fullWidth />}
              <TextField label="Timeout seconds" type="number" value={timeoutSec} onChange={(e) => setTimeoutSec(Number(e.target.value))} slotProps={{ htmlInput: { min: 5, max: 120 } }} fullWidth />
              <TextField label="Retries on 429/529" type="number" value={retries} onChange={(e) => setRetries(Number(e.target.value))} slotProps={{ htmlInput: { min: 0, max: 8 } }} fullWidth />
              <Box><Typography gutterBottom>Confidence threshold {(threshold * 100).toFixed(0)}%</Typography><Slider value={threshold} onChange={(_, value) => setThreshold(value as number)} min={0.5} max={0.99} step={0.01} valueLabelDisplay="auto" /></Box>
              <FormControlLabel control={<Switch checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} />} label="Show raw JSON" />
              <Stack direction="row" spacing={1}><Button variant="contained" startIcon={<PlayArrowIcon />} disabled={loading || !buildResult.request} onClick={() => void run()}>Run Ctrl+Enter</Button><Button variant="outlined" startIcon={<StopIcon />} disabled={!loading} onClick={() => abortRef.current?.abort()}>Cancel</Button><Button onClick={() => setCodeOpen(true)}>Code</Button></Stack>
              {loading && <LinearProgress aria-label="Running Jev request" />}
            </Stack></CardContent></Card>
            {response && <Card variant="outlined"><CardContent><Stack spacing={2}>
              <Typography variant="h5">Summary</Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <Chip label={`model ${response.result.model}`} />
                <Chip label={`${response.meta.latencyMs ?? 'n/a'} ms`} />
                <Chip label={`${usage?.input_tokens ?? 0} input tokens`} />
                <Chip label={`${usage?.output_tokens ?? 0} output tokens`} />
                <Chip label={formatUsd(cost)} />
                <Chip label={`gateway ${response.meta.gateway ?? 'unknown'}`} />
                {response.meta.apimRequestId && <Chip label={`APIM ${response.meta.apimRequestId}`} />}
                {response.meta.correlationId && <Chip label={`corr ${response.meta.correlationId}`} />}
                {composite !== null && <Chip color="secondary" label={`composite ${composite.toFixed(2)}`} />}
              </Stack>
            </Stack></CardContent></Card>}
          </Stack>
        </Grid>
      </Grid>
      {response && <Stack spacing={2}>{Object.entries(response.result.answers).map(([id, answer]) => <ResultCard key={id} id={id} answer={answer} threshold={threshold} />)}</Stack>}
      {showRaw && <Stack spacing={2}>{lastRequest && <JsonViewer title="raw request" value={lastRequest} defaultOpen />}{response && <JsonViewer title="raw response" value={response} defaultOpen />}</Stack>}
      <CodeDialog open={codeOpen} onClose={() => setCodeOpen(false)} request={buildResult.request} />
    </Stack>
  );
}

function QuestionCard({ question, index, onChange, onDelete, onDuplicate }: { question: EditableQuestion; index: number; onChange: (index: number, patch: Partial<EditableQuestion>) => void; onDelete: () => void; onDuplicate: () => void }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' } }}>
          <TextField label="Question id" value={question.id} onChange={(e) => onChange(index, { id: e.target.value })} fullWidth />
          <FormControl sx={{ minWidth: 160 }}><InputLabel id={`type-${index}`}>Type</InputLabel><Select labelId={`type-${index}`} label="Type" value={question.type} onChange={(e) => onChange(index, { type: e.target.value as QuestionType })}><MenuItem value="noul">noul</MenuItem><MenuItem value="choice">choice</MenuItem><MenuItem value="score">score</MenuItem></Select></FormControl>
          <Tooltip title="Duplicate"><IconButton aria-label="Duplicate question" onClick={onDuplicate}><ContentCopyIcon /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton aria-label="Delete question" onClick={onDelete} color="error"><DeleteIcon /></IconButton></Tooltip>
        </Stack>
        <FormControlLabel control={<Switch checked={question.instructionsMode === 'json'} onChange={(e) => onChange(index, { instructionsMode: e.target.checked ? 'json' : 'text' })} />} label="JSON instructions" />
        <TextField label="Instructions" value={question.instructionsText} onChange={(e) => onChange(index, { instructionsText: e.target.value })} multiline minRows={3} fullWidth />
        <Divider />
        {question.type === 'noul' && <Grid container spacing={2}><Grid size={{ xs: 12, md: 6 }}><TextField label="True criteria" value={question.noulTrue} onChange={(e) => onChange(index, { noulTrue: e.target.value })} fullWidth /></Grid><Grid size={{ xs: 12, md: 6 }}><TextField label="False criteria" value={question.noulFalse} onChange={(e) => onChange(index, { noulFalse: e.target.value })} fullWidth /></Grid></Grid>}
        {question.type === 'choice' && <Stack spacing={1}>{question.choiceRows.map((row, rowIndex) => <Stack direction="row" spacing={1} key={rowIndex}><TextField label="Option key" value={row.key} onChange={(e) => onChange(index, { choiceRows: question.choiceRows.map((r, i) => i === rowIndex ? { ...r, key: e.target.value } : r) })} /><TextField label="Description" value={row.description} onChange={(e) => onChange(index, { choiceRows: question.choiceRows.map((r, i) => i === rowIndex ? { ...r, description: e.target.value } : r) })} fullWidth /><IconButton aria-label="Remove option" onClick={() => onChange(index, { choiceRows: question.choiceRows.filter((_, i) => i !== rowIndex) })}><DeleteIcon /></IconButton></Stack>)}<Button startIcon={<AddIcon />} onClick={() => onChange(index, { choiceRows: [...question.choiceRows, { key: `option_${question.choiceRows.length + 1}`, description: '' }] })}>Add option</Button></Stack>}
        {question.type === 'score' && <Stack spacing={1}>{question.scoreLevels.map((level, levelIndex) => <Stack direction="row" spacing={1} key={levelIndex}><TextField label={`Level ${levelIndex}`} value={level} onChange={(e) => onChange(index, { scoreLevels: question.scoreLevels.map((l, i) => i === levelIndex ? e.target.value : l) })} fullWidth /><Button disabled={levelIndex === 0} onClick={() => onChange(index, { scoreLevels: move(question.scoreLevels, levelIndex, levelIndex - 1) })}>Up</Button><Button disabled={levelIndex === question.scoreLevels.length - 1} onClick={() => onChange(index, { scoreLevels: move(question.scoreLevels, levelIndex, levelIndex + 1) })}>Down</Button><IconButton aria-label="Remove level" onClick={() => onChange(index, { scoreLevels: question.scoreLevels.filter((_, i) => i !== levelIndex) })}><DeleteIcon /></IconButton></Stack>)}<Button startIcon={<AddIcon />} disabled={question.scoreLevels.length >= 10} onClick={() => onChange(index, { scoreLevels: [...question.scoreLevels, `level ${question.scoreLevels.length}`] })}>Add level</Button></Stack>}
      </Stack>
    </Paper>
  );
}

function move<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function toEditable(id: string, question: Question): EditableQuestion {
  const instructionsMode = typeof question.instructions === 'string' ? 'text' : 'json';
  return {
    id,
    type: question.type,
    instructionsMode,
    instructionsText: instructionsMode === 'text' ? String(question.instructions) : compactJson(question.instructions),
    noulTrue: question.type === 'noul' ? question.criteria?.true ?? '' : '',
    noulFalse: question.type === 'noul' ? question.criteria?.false ?? '' : '',
    choiceRows: question.type === 'choice' ? Object.entries(question.criteria).map(([key, description]) => ({ key, description: description ?? '' })) : [{ key: 'option_a', description: '' }, { key: 'option_b', description: '' }],
    scoreLevels: question.type === 'score' ? question.criteria : ['low', 'high'],
  };
}

function CodeDialog({ open, onClose, request }: { open: boolean; onClose: () => void; request?: JevRequest }) {
  const body = request ? JSON.stringify(request, null, 2) : '{}';
  const curl = `curl -X POST "https://<your-apim>.azure-api.net/jev/v1/systemone?timeout=30" \\\n  -H "Content-Type: application/json" \\\n  -H "Ocp-Apim-Subscription-Key: <your-subscription-key>" \\\n  -d '${body.replaceAll("'", "'\\''")}'`;
  const python = `import httpx\n\nbody = ${body}\nheaders = {"Ocp-Apim-Subscription-Key": "<your-subscription-key>"}\nresponse = httpx.post("https://<your-apim>.azure-api.net/jev/v1/systemone", json=body, headers=headers, timeout=30)\nresponse.raise_for_status()\nprint(response.json())`;
  const js = `const body = ${body};\nconst response = await fetch("https://<your-apim>.azure-api.net/jev/v1/systemone?timeout=30", {\n  method: "POST",\n  headers: {"content-type": "application/json", "Ocp-Apim-Subscription-Key": "<your-subscription-key>"},\n  body: JSON.stringify(body)\n});\nconsole.log(await response.json());`;
  return <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth><DialogTitle>Direct APIM snippets</DialogTitle><DialogContent><Stack spacing={2}><JsonViewer title="curl" value={curl} defaultOpen /><JsonViewer title="Python httpx" value={python} /><JsonViewer title="JavaScript fetch" value={js} /></Stack></DialogContent></Dialog>;
}
