'use client';

import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';

export function JsonViewer({ title, value, defaultOpen = false }: { title: string; value: unknown; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <Button size="small" variant="outlined" onClick={() => setOpen((current) => !current)} aria-expanded={open}>{open ? 'Hide' : 'Show'} {title}</Button>
        <Button size="small" startIcon={<ContentCopyIcon />} onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); }}>Copy</Button>
      </Stack>
      {copied && <Alert severity="success" sx={{ mb: 1 }} onClose={() => setCopied(false)}>Copied to clipboard.</Alert>}
      <Collapse in={open}>
        <Paper variant="outlined" component="pre" sx={{ p: 2, overflow: 'auto', maxHeight: 420, whiteSpace: 'pre-wrap', fontSize: 13 }}>
          <Typography component="code" variant="body2">{text}</Typography>
        </Paper>
      </Collapse>
    </Box>
  );
}
