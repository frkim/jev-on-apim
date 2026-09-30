'use client';

import RestoreIcon from '@mui/icons-material/Restore';
import SaveIcon from '@mui/icons-material/Save';
import WifiTetheringIcon from '@mui/icons-material/WifiTethering';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@/components/ResponsiveGrid';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { getHealth, getModels } from '@/lib/api';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type AppSettings } from '@/lib/storage';

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setSettings(loadSettings()), []);
  const patch = (value: Partial<AppSettings>) => setSettings((current) => ({ ...current, ...value }));
  async function testConnection() {
    setError(null); setMessage(null);
    try {
      const [health, models] = await Promise.all([getHealth({ baseUrl: settings.apiBaseUrl }), getModels({ baseUrl: settings.apiBaseUrl })]);
      setMessage(`Connected: ${health.status}, mode ${health.mode}, APIM configured ${health.apimConfigured ? 'yes' : 'no'}, ${models.data.length} model(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'API unreachable. The UI will continue to work; configure API base or start the local API.');
    }
  }
  return <Stack spacing={3}><div><Typography variant="h3" gutterBottom>Settings</Typography><Typography color="text.secondary">Runtime browser settings are persisted in localStorage.</Typography></div>{message && <Alert severity="success">{message}</Alert>}{error && <Alert severity="warning">{error}</Alert>}<Card variant="outlined"><CardContent><Grid container spacing={2}><Grid size={{ xs: 12, md: 6 }}><TextField label="API base URL" value={settings.apiBaseUrl} onChange={(e) => patch({ apiBaseUrl: e.target.value })} helperText="Default /api; use http://localhost:7071/api for local Functions." fullWidth /></Grid><Grid size={{ xs: 12, md: 6 }}><TextField label="Default model" value={settings.defaultModel} onChange={(e) => patch({ defaultModel: e.target.value })} fullWidth /></Grid><Grid size={{ xs: 6, md: 3 }}><TextField label="Timeout seconds" type="number" value={settings.timeoutSec} onChange={(e) => patch({ timeoutSec: Number(e.target.value) })} fullWidth /></Grid><Grid size={{ xs: 6, md: 3 }}><TextField label="Retries" type="number" value={settings.retries} onChange={(e) => patch({ retries: Number(e.target.value) })} fullWidth /></Grid><Grid size={{ xs: 6, md: 3 }}><TextField label="Concurrency" type="number" value={settings.concurrency} onChange={(e) => patch({ concurrency: Number(e.target.value) })} fullWidth /></Grid><Grid size={{ xs: 6, md: 3 }}><TextField label="Input price / 1M USD" type="number" value={settings.pricePerMillionInputUsd} onChange={(e) => patch({ pricePerMillionInputUsd: Number(e.target.value) })} fullWidth /></Grid><Grid size={{ xs: 12, md: 6 }}><Typography gutterBottom>Confidence threshold {(settings.confidenceThreshold * 100).toFixed(0)}%</Typography><Slider value={settings.confidenceThreshold} min={0.5} max={0.99} step={0.01} onChange={(_, value) => patch({ confidenceThreshold: value as number })} /></Grid><Grid size={{ xs: 12 }}><Stack direction="row" spacing={1}><Button variant="contained" startIcon={<SaveIcon />} onClick={() => { saveSettings(settings); setMessage('Settings saved.'); }}>Save</Button><Button startIcon={<WifiTetheringIcon />} onClick={() => void testConnection()}>Test connection</Button><Button startIcon={<RestoreIcon />} onClick={() => { setSettings(DEFAULT_SETTINGS); saveSettings(DEFAULT_SETTINGS); }}>Reset defaults</Button></Stack></Grid></Grid></CardContent></Card></Stack>;
}
