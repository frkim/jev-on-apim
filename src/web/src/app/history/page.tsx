'use client';

import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import ReplayIcon from '@mui/icons-material/Replay';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { DataGrid, GridToolbar, type GridColDef } from '@mui/x-data-grid';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { JsonViewer } from '@/components/JsonViewer';
import { estimateInputCost, formatUsd } from '@/lib/jev';
import { clearHistory, deleteHistory, loadHistory, setPlaygroundHandoff, type HistoryEntry } from '@/lib/storage';

export default function HistoryPage() {
  const [rows, setRows] = useState<HistoryEntry[]>([]);
  const [selected, setSelected] = useState<HistoryEntry | null>(null);
  const router = useRouter();
  useEffect(() => setRows(loadHistory()), []);
  const columns: GridColDef<HistoryEntry>[] = useMemo(() => [
    { field: 'createdAt', headerName: 'Time', flex: 1.2, minWidth: 190, valueFormatter: (value: string) => new Date(value).toLocaleString() },
    { field: 'model', headerName: 'Model', flex: 1, minWidth: 130, valueGetter: (_, row) => row.request.model },
    { field: 'questions', headerName: '# Questions', type: 'number', width: 120, valueGetter: (_, row) => Object.keys(row.request.questions).length },
    { field: 'latencyMs', headerName: 'Latency', type: 'number', width: 110 },
    { field: 'tokens', headerName: 'Tokens', width: 120, valueGetter: (_, row) => row.response?.result.usage.input_tokens ?? 0 },
    { field: 'cost', headerName: 'Cost', width: 120, valueGetter: (_, row) => formatUsd(estimateInputCost(row.response?.result.usage.input_tokens ?? 0)) },
    { field: 'gateway', headerName: 'Gateway', width: 110, valueGetter: (_, row) => row.gateway ?? row.response?.meta.gateway ?? 'n/a' },
    { field: 'status', headerName: 'Status', width: 120, valueGetter: (_, row) => row.error ? 'error' : 'success' },
    { field: 'actions', headerName: 'Actions', width: 130, sortable: false, filterable: false, renderCell: ({ row }) => <Stack direction="row"><IconButton aria-label="Re-open in playground" onClick={(event) => { event.stopPropagation(); setPlaygroundHandoff({ state: row.request.state, questions: row.request.questions, model: row.request.model }); router.push('/'); }}><ReplayIcon /></IconButton><IconButton aria-label="Delete run" color="error" onClick={(event) => { event.stopPropagation(); setRows(deleteHistory(row.id)); }}><DeleteIcon /></IconButton></Stack> },
  ], [router]);
  return <Stack spacing={3}><Box><Typography variant="h3" gutterBottom>History</Typography><Typography color="text.secondary">Local browser history is capped at 200 runs.</Typography></Box><Stack direction="row" spacing={1}><Button startIcon={<DownloadIcon />} disabled={!rows.length} onClick={() => download('jev-history.json', JSON.stringify(rows, null, 2))}>Export JSON</Button><Button color="error" disabled={!rows.length} onClick={() => { clearHistory(); setRows([]); }}>Clear all</Button></Stack><Card variant="outlined"><CardContent><DataGrid rows={rows} columns={columns} autoHeight pageSizeOptions={[10, 25, 50]} initialState={{ pagination: { paginationModel: { pageSize: 10 } } }} slots={{ toolbar: GridToolbar }} disableRowSelectionOnClick onRowClick={(params) => setSelected(params.row)} /></CardContent></Card><Drawer anchor="right" open={Boolean(selected)} onClose={() => setSelected(null)}><Box sx={{ width: { xs: 360, md: 620 }, p: 2 }}>{selected && <Stack spacing={2}><Typography variant="h5">Run detail</Typography><JsonViewer title="request" value={selected.request} defaultOpen />{selected.response && <JsonViewer title="response" value={selected.response} defaultOpen />}{selected.error && <Typography color="error">{selected.error}</Typography>}</Stack>}</Box></Drawer></Stack>;
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
