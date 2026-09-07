import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/routes/index.tsx', import.meta.url), 'utf8');
const tests = [
  ['landing-get-started test id', (source.match(/data-testid="landing-get-started"/g) ?? []).length === 1],
  ['landing-sign-in test id', (source.match(/data-testid="landing-sign-in"/g) ?? []).length === 1],
  ['no duplicate blue-strip Get started text', !/function HeroNavStrip\(\)[\s\S]*?Get started[\s\S]*?function Hero\(/.test(source)],
  ['no secondary Start free CTA', !/>\s*Start free\s*</.test(source)],
  ['no lower Get started free CTA', !/Get started free/.test(source)],
  ['header illustration is not keyboard-interactive', /pointer-events-none/.test(source) && /draggable=\{false\}/.test(source)],
];

const failed = tests.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error(`Landing CTA check failed: ${failed.join(', ')}`);
  process.exit(1);
}
console.log('Landing CTA check passed: one Get started, one Sign in, no duplicate hero-strip CTAs.');
