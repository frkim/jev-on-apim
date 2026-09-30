import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export default function AboutPage() {
  return <Stack spacing={3}><Box><Typography variant="h3" gutterBottom>About Jev Evaluation Studio</Typography><Typography color="text.secondary">A static, client-side lab for TypeSafe AI's Jev System One model.</Typography></Box><Card variant="outlined"><CardContent><Stack spacing={2}><Typography variant="h5">What Jev is</Typography><Typography>Jev is a decision model: it does not chat or generate long text. It answers typed questions about a supplied state with probabilities for yes/no, choices, or ordered scores.</Typography><Typography variant="h5">Architecture</Typography><Typography>Browser static app → Azure Static Web Apps managed /api proxy → Azure API Management with subscription key, 429/529 retry, Key Vault named value, and App Insights → jevmodel.org.</Typography><Typography variant="h5">Question types</Typography><Typography><strong>noul</strong> returns P(yes). <strong>choice</strong> returns a winning option and probability distribution. <strong>score</strong> returns a float across ordered levels plus per-level probabilities.</Typography><Typography>Learn more: <Link href="https://jevmodel.org">jevmodel.org</Link> and <Link href="https://docs.typesafe.ai">docs.typesafe.ai</Link>.</Typography></Stack></CardContent></Card></Stack>;
}
