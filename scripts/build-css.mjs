import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = path.join(root, 'src', 'styles.css');
const output = path.join(root, 'dist', 'styles.css');

const source = await readFile(input, 'utf8');
const result = await postcss([tailwind()]).process(source, { from: input, to: output });
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, result.css, 'utf8');
console.log(`Tailwind compilado: ${path.relative(root, output)}`);
