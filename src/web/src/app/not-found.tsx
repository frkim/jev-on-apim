import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';

export default function NotFound() {
  return (
    <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
      <Typography variant="h3">Page not found</Typography>
      <Typography color="text.secondary">The requested Jev Studio page does not exist.</Typography>
      <Button component={Link} href="/" variant="contained">Back to Playground</Button>
    </Stack>
  );
}
