import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const assetsDir = join(process.cwd(), 'dist', 'assets');
const maxRawKb = Number(process.env.MAIN_CHUNK_MAX_KB ?? 650);
const maxGzipKb = Number(process.env.MAIN_CHUNK_GZIP_MAX_KB ?? 190);

const candidates = readdirSync(assetsDir).filter((name) => /^index-.*\.js$/.test(name));

if (candidates.length === 0) {
  console.error(`No main entry chunk found in ${assetsDir}`);
  process.exit(1);
}

const results = candidates.map((name) => {
  const filePath = join(assetsDir, name);
  const rawBytes = statSync(filePath).size;
  const gzipBytes = gzipSync(readFileSync(filePath)).length;

  return {
    name,
    rawKb: rawBytes / 1024,
    gzipKb: gzipBytes / 1024,
  };
});

results.sort((a, b) => b.rawKb - a.rawKb);
const mainChunk = results[0];

const rawOk = mainChunk.rawKb <= maxRawKb;
const gzipOk = mainChunk.gzipKb <= maxGzipKb;

console.log(`Main chunk: ${mainChunk.name}`);
console.log(`Raw size: ${mainChunk.rawKb.toFixed(2)}KB (budget ${maxRawKb}KB)`);
console.log(`Gzip size: ${mainChunk.gzipKb.toFixed(2)}KB (budget ${maxGzipKb}KB)`);

if (!rawOk || !gzipOk) {
  console.error('Bundle budget check failed.');
  process.exit(1);
}

console.log('Bundle budget check passed.');
