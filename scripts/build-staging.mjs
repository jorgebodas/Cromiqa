// Builds a private staging preview (published as a claude.ai Artifact, never to GitHub Pages).
// Output: dist-staging/staging.html (page body only; the Artifact host adds the document
// skeleton) plus dist-staging/assets/*. Lead submissions are simulated in this mode.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

execSync('npx vite build --mode staging --logLevel warn', { stdio: 'inherit' });
const html = readFileSync('dist-staging/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const keep = [...head.matchAll(/<(script|link)\b[^>]*(src|href)="\.\/assets\/[^"]+"[^>]*>(<\/script>)?/g)].map((m) => m[0]);
const page = `<title>Cromiqa Staging</title>
<meta name="robots" content="noindex" />
${keep.join('\n')}
<style>html, body { background: #fff; color-scheme: light; }</style>
${body.trim()}
`;
writeFileSync('dist-staging/staging.html', page);
console.log('staging ready: dist-staging/staging.html');
