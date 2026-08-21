#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  closeSync,
  createReadStream,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const HEADER_BYTES = 4_377;
const NAME_BYTES = 255;
const SIZE_BYTES = 14;
const MTIME_BYTES = 12;

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const values = new Map();
  const paths = [];
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) fail(`Invalid argument at position ${index + 1}`);
    if (key === '--path') paths.push(value);
    else values.set(key, value);
  }
  if (!values.get('--wpress') || !values.get('--source-manifest') || !values.get('--output') || !paths.length) {
    fail(
      'Usage: node scripts/migration/archive-public-media-evidence.mjs --wpress <file> --source-manifest <json> --output <temp-json> --path <uploads-relative-path> [--path ...]',
    );
  }
  return {
    output: resolve(values.get('--output')),
    paths,
    sourceManifest: resolve(values.get('--source-manifest')),
    wpress: resolve(values.get('--wpress')),
  };
}

function assertOutsideRepository(target) {
  const repository = resolve(process.cwd());
  const relation = relative(repository, target);
  if (relation === '' || (!relation.startsWith(`..${sep}`) && relation !== '..' && !isAbsolute(relation))) {
    fail(`Public-media evidence output must be outside the repository: ${target}`);
  }
}

function nulTerminated(buffer) {
  const end = buffer.indexOf(0);
  return buffer.subarray(0, end === -1 ? buffer.length : end).toString('utf8');
}

function numericField(buffer, label) {
  const raw = nulTerminated(buffer).trim();
  if (!/^\d+$/u.test(raw)) fail(`Invalid ${label}: ${JSON.stringify(raw)}`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) fail(`Unsafe ${label}: ${raw}`);
  return value;
}

function normalizeRequestedPath(value) {
  const normalized = value.replace(/^uploads\//u, '');
  if (
    !normalized ||
    normalized.startsWith('/') ||
    normalized.startsWith('\\') ||
    /^[A-Za-z]:/u.test(normalized) ||
    normalized.includes('\\') ||
    normalized.split('/').includes('..')
  ) {
    fail(`Unsafe requested upload path: ${JSON.stringify(value)}`);
  }
  return normalized;
}

function logicalPath(prefix, name) {
  const normalizedPrefix = prefix === '.' || prefix === '' ? '' : prefix;
  return normalizedPrefix ? `${normalizedPrefix}/${name}` : name;
}

function findEntries(wpressPath, requestedPaths) {
  const wanted = new Set(requestedPaths.map((path) => `uploads/${path}`));
  const found = new Map();
  const archiveBytes = statSync(wpressPath).size;
  const header = Buffer.alloc(HEADER_BYTES);
  const fd = openSync(wpressPath, 'r');
  let offset = 0;
  let footerFound = false;

  try {
    while (offset < archiveBytes) {
      const bytesRead = readSync(fd, header, 0, HEADER_BYTES, offset);
      if (bytesRead !== HEADER_BYTES) fail(`Truncated WPress header at byte ${offset}`);
      const name = nulTerminated(header.subarray(0, NAME_BYTES));
      const rawSize = header.subarray(NAME_BYTES, NAME_BYTES + SIZE_BYTES);
      if (!name) {
        const footerPointer = numericField(rawSize, 'footer pointer');
        if (footerPointer !== offset || offset + HEADER_BYTES !== archiveBytes) fail('Invalid WPress footer');
        footerFound = true;
        offset += HEADER_BYTES;
        break;
      }

      const size = numericField(rawSize, 'entry size');
      const prefix = nulTerminated(header.subarray(NAME_BYTES + SIZE_BYTES + MTIME_BYTES));
      const path = logicalPath(prefix, name);
      const dataOffset = offset + HEADER_BYTES;
      const dataEnd = dataOffset + size;
      if (dataEnd > archiveBytes) fail(`Entry exceeds WPress bounds: ${path}`);
      if (wanted.has(path)) {
        if (found.has(path)) fail(`Duplicate requested archive path: ${path}`);
        found.set(path, { dataOffset, size });
      }
      offset = dataEnd;
    }
  } finally {
    closeSync(fd);
  }

  if (!footerFound || offset !== archiveBytes) fail('WPress stream did not end at a valid footer');
  return found;
}

async function hashEntry(wpressPath, entry) {
  const hash = createHash('sha256');
  let bytes = 0;
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      hash.update(chunk);
      bytes += chunk.length;
      callback();
    },
  });
  await pipeline(
    createReadStream(wpressPath, { end: entry.dataOffset + entry.size - 1, start: entry.dataOffset }),
    sink,
  );
  if (bytes !== entry.size) fail(`Read ${bytes} bytes; expected ${entry.size}`);
  return hash.digest('hex').toUpperCase();
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  assertOutsideRepository(options.output);
  const sourceManifest = JSON.parse(readFileSync(options.sourceManifest, 'utf8'));
  const sourceEvidence = sourceManifest?.sources?.standaloneWpress;
  if (!sourceEvidence?.sha256 || !sourceEvidence?.bytes) fail('Sanitized source manifest is missing WPress identity');
  const sourceStats = statSync(options.wpress);
  if (!sourceStats.isFile() || sourceStats.size !== sourceEvidence.bytes) fail('WPress source size does not match verified inventory');

  const paths = options.paths.map(normalizeRequestedPath);
  if (new Set(paths).size !== paths.length) fail('Duplicate requested upload path');
  const found = findEntries(options.wpress, paths);
  const entries = [];
  for (const path of paths) {
    const archiveEntry = found.get(`uploads/${path}`);
    entries.push(
      archiveEntry
        ? { bytes: archiveEntry.size, path, present: true, sha256: await hashEntry(options.wpress, archiveEntry) }
        : { bytes: null, path, present: false, sha256: null },
    );
  }

  const evidence = { archiveSha256: sourceEvidence.sha256, entries };
  mkdirSync(dirname(options.output), { recursive: true });
  writeFileSync(options.output, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ evidence, output: options.output }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
