#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  closeSync,
  createReadStream,
  createWriteStream,
  mkdirSync,
  mkdtempSync,
  openSync,
  readSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createInflateRaw } from 'node:zlib';

const HEADER_BYTES = 4_377;
const NAME_BYTES = 255;
const SIZE_BYTES = 14;
const MTIME_BYTES = 12;
const PREFIX_BYTES = 4_096;

const MEDIA_EXTENSIONS = new Set([
  'avif',
  'gif',
  'jpeg',
  'jpg',
  'mp3',
  'mp4',
  'pdf',
  'png',
  'svg',
  'webm',
  'webp',
]);

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const args = new Map();
  const flags = new Set();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) fail(`Unexpected argument: ${token}`);
    if (token === '--extract-approved') {
      flags.add(token);
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) fail(`Missing value for ${token}`);
    args.set(token, value);
    index += 1;
  }

  const wpress = args.get('--wpress');
  const zip = args.get('--zip');
  if (!wpress || !zip) {
    fail(
      'Usage: node scripts/migration/archive-inspect.mjs --wpress <file> --zip <file> [--manifest <json>] [--temp-root <directory>] [--extract-approved]',
    );
  }

  return {
    extractApproved: flags.has('--extract-approved'),
    manifest: args.get('--manifest'),
    tempRoot: args.get('--temp-root'),
    wpress,
    zip,
  };
}

function assertRegularFile(filePath, label) {
  const resolved = resolve(filePath);
  const stats = statSync(resolved);
  if (!stats.isFile()) fail(`${label} is not a regular file: ${resolved}`);
  return { path: resolved, stats };
}

function assertOutsideRepository(target, repositoryRoot) {
  const resolvedTarget = resolve(target);
  const resolvedRepository = resolve(repositoryRoot);
  const relation = relative(resolvedRepository, resolvedTarget);
  if (relation === '' || (!relation.startsWith(`..${sep}`) && relation !== '..' && !isAbsolute(relation))) {
    fail(`Raw extraction target must be outside the repository: ${resolvedTarget}`);
  }
}

function nulTerminated(buffer) {
  const end = buffer.indexOf(0);
  return buffer.subarray(0, end === -1 ? buffer.length : end).toString('utf8');
}

function numericField(buffer, label) {
  const raw = nulTerminated(buffer).trim();
  if (!/^\d+$/.test(raw)) fail(`Invalid ${label} field: ${JSON.stringify(raw)}`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) fail(`Unsafe ${label} value: ${raw}`);
  return value;
}

function archivePath(prefix, name) {
  const normalizedPrefix = prefix === '.' || prefix === '' ? '' : prefix;
  const value = normalizedPrefix ? `${normalizedPrefix}/${name}` : name;
  if (
    value.startsWith('/') ||
    value.startsWith('\\') ||
    /^[A-Za-z]:/.test(value) ||
    value.split(/[\\/]/u).includes('..') ||
    value.includes('\\')
  ) {
    fail(`Unsafe archive path: ${JSON.stringify(value)}`);
  }
  return value;
}

function extensionOf(filePath) {
  const name = filePath.split('/').at(-1) ?? '';
  const index = name.lastIndexOf('.');
  return index > 0 ? name.slice(index + 1).toLowerCase() : '(none)';
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function sortedRecord(map) {
  return Object.fromEntries([...map.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function classifyEntry(entryPath, extension) {
  const top = entryPath.includes('/') ? entryPath.split('/')[0] : '(root)';
  if (top === 'uploads') return 'uploads';
  if (top === 'plugins') return 'plugins';
  if (top === 'themes') return 'themes';
  if (top === 'languages') return 'languages';
  if (top === 'mu-plugins') return 'mu-plugins';
  if (entryPath === 'database.sql') return 'database';
  if (
    extension === 'log' ||
    extension === 'html_gzip' ||
    top.includes('cache') ||
    top.includes('wflogs') ||
    top.includes('backup')
  ) {
    return 'cache-logs-backups';
  }
  return top === '(root)' ? 'root-other' : 'other';
}

function scanWpress(filePath) {
  const fd = openSync(filePath, 'r');
  const archiveBytes = statSync(filePath).size;
  const header = Buffer.alloc(HEADER_BYTES);
  const entriesByPath = new Map();
  const extensionCounts = new Map();
  const bucketCounts = new Map();
  const bucketBytes = new Map();
  const uploadExtensionCounts = new Map();
  const uploadCandidateExtensionCounts = new Map();
  const uploadCandidates = [];
  let offset = 0;
  let payloadBytes = 0;
  let footer;

  try {
    while (offset < archiveBytes) {
      const bytesRead = readSync(fd, header, 0, HEADER_BYTES, offset);
      if (bytesRead !== HEADER_BYTES) fail(`Truncated WPress header at byte ${offset}`);

      const name = nulTerminated(header.subarray(0, NAME_BYTES));
      const rawSize = header.subarray(NAME_BYTES, NAME_BYTES + SIZE_BYTES);

      if (!name) {
        if (offset + HEADER_BYTES !== archiveBytes) fail(`Unexpected WPress footer at byte ${offset}`);
        const pointer = numericField(rawSize, 'footer pointer');
        const signature = header.subarray(HEADER_BYTES - 8).toString('ascii');
        if (pointer !== offset) fail(`WPress footer pointer ${pointer} does not match footer offset ${offset}`);
        if (!/^[0-9a-f]{8}$/u.test(signature)) fail(`Invalid WPress footer signature: ${signature}`);
        footer = { offset, pointer, pointerMatchesOffset: true, signature };
        offset += HEADER_BYTES;
        break;
      }

      const size = numericField(rawSize, 'entry size');
      const modifiedEpochSeconds = numericField(
        header.subarray(NAME_BYTES + SIZE_BYTES, NAME_BYTES + SIZE_BYTES + MTIME_BYTES),
        'entry mtime',
      );
      const prefix = nulTerminated(header.subarray(NAME_BYTES + SIZE_BYTES + MTIME_BYTES));
      const path = archivePath(prefix, name);
      const dataOffset = offset + HEADER_BYTES;
      const dataEnd = dataOffset + size;
      if (dataEnd > archiveBytes) fail(`Entry exceeds WPress bounds: ${path}`);
      if (entriesByPath.has(path)) fail(`Duplicate WPress path: ${path}`);

      const extension = extensionOf(path);
      const bucket = classifyEntry(path, extension);
      const entry = { dataOffset, modifiedEpochSeconds, path, size };
      entriesByPath.set(path, entry);
      increment(extensionCounts, extension);
      increment(bucketCounts, bucket);
      increment(bucketBytes, bucket, size);
      if (bucket === 'uploads') {
        increment(uploadExtensionCounts, extension);
        if (MEDIA_EXTENSIONS.has(extension)) {
          uploadCandidates.push(entry);
          increment(uploadCandidateExtensionCounts, extension);
        }
      }

      payloadBytes += size;
      offset = dataEnd;
    }
  } finally {
    closeSync(fd);
  }

  if (!footer) fail('WPress footer was not found');
  if (offset !== archiveBytes) fail(`WPress scan ended at ${offset}, expected ${archiveBytes}`);

  const packageEntry = entriesByPath.get('package.json');
  const databaseEntry = entriesByPath.get('database.sql');
  if (!packageEntry) fail('Root package.json is missing from WPress archive');
  if (!databaseEntry) fail('Root database.sql is missing from WPress archive');

  return {
    archiveBytes,
    bucketBytes,
    bucketCounts,
    databaseEntry,
    entryCount: entriesByPath.size,
    extensionCounts,
    footer,
    packageEntry,
    payloadBytes,
    uploadCandidates,
    uploadCandidateExtensionCounts,
    uploadExtensionCounts,
  };
}

async function hashFile(filePath) {
  const hash = createHash('sha256');
  let bytes = 0;
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      hash.update(chunk);
      bytes += chunk.length;
      callback();
    },
  });
  await pipeline(createReadStream(filePath), sink);
  return { bytes, sha256: hash.digest('hex').toUpperCase() };
}

async function copyAndHashRange(source, entry, destination) {
  const hash = createHash('sha256');
  let bytes = 0;
  const hasher = new Transform({
    transform(chunk, _encoding, callback) {
      hash.update(chunk);
      bytes += chunk.length;
      callback(null, chunk);
    },
  });
  const sink = destination
    ? createWriteStream(destination, { flags: 'wx', mode: 0o600 })
    : new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  await pipeline(
    createReadStream(source, { end: entry.dataOffset + entry.size - 1, start: entry.dataOffset }),
    hasher,
    sink,
  );

  if (bytes !== entry.size) fail(`Extracted ${bytes} bytes for ${entry.path}; expected ${entry.size}`);
  return { bytes, sha256: hash.digest('hex').toUpperCase() };
}

function parseZip(filePath) {
  const stats = statSync(filePath);
  const tailBytes = Math.min(stats.size, 65_557);
  const fd = openSync(filePath, 'r');
  const tail = Buffer.alloc(tailBytes);
  readSync(fd, tail, 0, tail.length, stats.size - tail.length);

  let eocdIndex = -1;
  for (let index = tail.length - 22; index >= 0; index -= 1) {
    if (tail.readUInt32LE(index) === 0x06054b50) {
      eocdIndex = index;
      break;
    }
  }
  if (eocdIndex === -1) fail('ZIP end-of-central-directory record was not found');
  const disk = tail.readUInt16LE(eocdIndex + 4);
  const centralDisk = tail.readUInt16LE(eocdIndex + 6);
  const entriesOnDisk = tail.readUInt16LE(eocdIndex + 8);
  const entryCount = tail.readUInt16LE(eocdIndex + 10);
  const centralBytes = tail.readUInt32LE(eocdIndex + 12);
  const centralOffset = tail.readUInt32LE(eocdIndex + 16);
  if (disk !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount) fail('Multi-disk ZIP files are not supported');
  if (entryCount === 0xffff || centralBytes === 0xffffffff || centralOffset === 0xffffffff) {
    fail('ZIP64 source wrappers are not supported by this verifier');
  }

  const central = Buffer.alloc(centralBytes);
  readSync(fd, central, 0, central.length, centralOffset);
  const entries = [];
  let cursor = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (central.readUInt32LE(cursor) !== 0x02014b50) fail(`Invalid ZIP central header ${index}`);
    const flags = central.readUInt16LE(cursor + 8);
    const method = central.readUInt16LE(cursor + 10);
    const crc32 = central.readUInt32LE(cursor + 16);
    const compressedBytes = central.readUInt32LE(cursor + 20);
    const uncompressedBytes = central.readUInt32LE(cursor + 24);
    const nameBytes = central.readUInt16LE(cursor + 28);
    const extraBytes = central.readUInt16LE(cursor + 30);
    const commentBytes = central.readUInt16LE(cursor + 32);
    const localOffset = central.readUInt32LE(cursor + 42);
    const name = central.subarray(cursor + 46, cursor + 46 + nameBytes).toString('utf8');
    archivePath('', name);
    if ((flags & 0x1) !== 0) fail(`Encrypted ZIP member is not permitted: ${name}`);
    if (method !== 0 && method !== 8) fail(`Unsupported ZIP compression method ${method} for ${name}`);

    const local = Buffer.alloc(30);
    readSync(fd, local, 0, local.length, localOffset);
    if (local.readUInt32LE(0) !== 0x04034b50) fail(`Invalid ZIP local header for ${name}`);
    const localNameBytes = local.readUInt16LE(26);
    const localExtraBytes = local.readUInt16LE(28);
    const dataOffset = localOffset + 30 + localNameBytes + localExtraBytes;
    entries.push({ compressedBytes, crc32, dataOffset, flags, method, name, uncompressedBytes });
    cursor += 46 + nameBytes + extraBytes + commentBytes;
  }
  closeSync(fd);
  if (cursor !== centralBytes) fail(`ZIP central directory ended at ${cursor}, expected ${centralBytes}`);
  return entries;
}

async function hashExpandedZipEntry(zipPath, entry) {
  const hash = createHash('sha256');
  let bytes = 0;
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      hash.update(chunk);
      bytes += chunk.length;
      callback();
    },
  });
  const compressed = createReadStream(zipPath, {
    end: entry.dataOffset + entry.compressedBytes - 1,
    start: entry.dataOffset,
  });
  if (entry.method === 8) await pipeline(compressed, createInflateRaw(), sink);
  else await pipeline(compressed, sink);
  if (bytes !== entry.uncompressedBytes) fail(`Expanded ZIP member has ${bytes} bytes; expected ${entry.uncompressedBytes}`);
  return { bytes, sha256: hash.digest('hex').toUpperCase() };
}

function isoFromStats(stats) {
  return stats.mtime.toISOString();
}

function isoFromEpochSeconds(value) {
  return new Date(value * 1_000).toISOString();
}

function crcHex(value) {
  return value.toString(16).toUpperCase().padStart(8, '0');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const repositoryRoot = resolve(process.cwd());
  const wpress = assertRegularFile(options.wpress, 'WPress source');
  const zip = assertRegularFile(options.zip, 'ZIP source');
  const scanned = scanWpress(wpress.path);
  const zipEntries = parseZip(zip.path);
  if (zipEntries.length !== 1) fail(`Expected one ZIP wrapper member; found ${zipEntries.length}`);

  const extractionDir = options.extractApproved
    ? mkdtempSync(join(resolve(options.tempRoot ?? tmpdir()), 'puffsticker-wp-audit-'))
    : undefined;
  if (extractionDir) assertOutsideRepository(extractionDir, repositoryRoot);

  const packageDestination = extractionDir ? join(extractionDir, 'package.json') : undefined;
  const databaseDestination = extractionDir ? join(extractionDir, 'database.sql') : undefined;
  const [wpressHash, zipHash, zipMemberHash, packageHash, databaseHash] = await Promise.all([
    hashFile(wpress.path),
    hashFile(zip.path),
    hashExpandedZipEntry(zip.path, zipEntries[0]),
    copyAndHashRange(wpress.path, scanned.packageEntry, packageDestination),
    copyAndHashRange(wpress.path, scanned.databaseEntry, databaseDestination),
  ]);

  const zipMember = zipEntries[0];
  const wrapperMatchesStandalone =
    zipMember.uncompressedBytes === wpress.stats.size && zipMemberHash.sha256 === wpressHash.sha256;
  if (!wrapperMatchesStandalone) fail('Expanded ZIP member does not match the standalone WPress source');

  if (extractionDir) {
    const uploadMetadata = {
      classification: 'candidate-public-media-requires-published-database-reconciliation',
      entries: scanned.uploadCandidates.map(({ modifiedEpochSeconds, path, size }) => ({
        modifiedEpochSeconds,
        path,
        size,
      })),
      sourceArchiveSha256: wpressHash.sha256,
    };
    writeFileSync(join(extractionDir, 'uploads-metadata.json'), `${JSON.stringify(uploadMetadata, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
  }

  const manifest = {
    formatVersion: 1,
    sources: {
      standaloneWpress: {
        bytes: wpress.stats.size,
        fileName: basename(wpress.path),
        lastModifiedUtc: isoFromStats(wpress.stats),
        sha256: wpressHash.sha256,
      },
      zipWrapper: {
        bytes: zip.stats.size,
        fileName: basename(zip.path),
        lastModifiedUtc: isoFromStats(zip.stats),
        sha256: zipHash.sha256,
      },
    },
    verification: {
      archiveEndedExactlyAtFooter: scanned.footer.offset + HEADER_BYTES === scanned.archiveBytes,
      expandedZipMemberMatchesStandalone: wrapperMatchesStandalone,
      noDuplicateLogicalPaths: true,
      noPathTraversalOrAbsolutePaths: true,
      selectedEntriesMatchDeclaredSizes: true,
    },
    zipWrapper: {
      entryCount: zipEntries.length,
      member: {
        compressedBytes: zipMember.compressedBytes,
        compressionMethod: zipMember.method === 8 ? 'deflate' : 'stored',
        crc32: crcHex(zipMember.crc32),
        expandedSha256: zipMemberHash.sha256,
        fileName: zipMember.name,
        uncompressedBytes: zipMember.uncompressedBytes,
      },
    },
    wpress: {
      archiveBytes: scanned.archiveBytes,
      bucketBytes: sortedRecord(scanned.bucketBytes),
      bucketCounts: sortedRecord(scanned.bucketCounts),
      entryCount: scanned.entryCount,
      extensionCounts: sortedRecord(scanned.extensionCounts),
      footer: scanned.footer,
      headerBytesIncludingFooter: (scanned.entryCount + 1) * HEADER_BYTES,
      headerLayoutBytes: {
        fileName: NAME_BYTES,
        fileSize: SIZE_BYTES,
        modifiedTime: MTIME_BYTES,
        prefix: PREFIX_BYTES,
        total: HEADER_BYTES,
      },
      payloadBytes: scanned.payloadBytes,
      selectedRootEntries: {
        databaseSql: {
          bytes: scanned.databaseEntry.size,
          modifiedEpochSeconds: scanned.databaseEntry.modifiedEpochSeconds,
          modifiedUtc: isoFromEpochSeconds(scanned.databaseEntry.modifiedEpochSeconds),
          sha256: databaseHash.sha256,
        },
        packageJson: {
          bytes: scanned.packageEntry.size,
          modifiedEpochSeconds: scanned.packageEntry.modifiedEpochSeconds,
          modifiedUtc: isoFromEpochSeconds(scanned.packageEntry.modifiedEpochSeconds),
          sha256: packageHash.sha256,
        },
      },
      uploads: {
        allEntries: {
          bytes: scanned.bucketBytes.get('uploads') ?? 0,
          count: scanned.bucketCounts.get('uploads') ?? 0,
          extensionCounts: sortedRecord(scanned.uploadExtensionCounts),
        },
        candidateMedia: {
          bytes: scanned.uploadCandidates.reduce((total, entry) => total + entry.size, 0),
          count: scanned.uploadCandidates.length,
          extensionCounts: sortedRecord(scanned.uploadCandidateExtensionCounts),
        },
      },
    },
    handlingPolicy: {
      committedArtifacts: 'sanitized aggregate inventory and checksums only',
      excludedFromRepository: [
        'raw database SQL',
        'WordPress/PHP/plugin/theme executables',
        'uploads and customer artwork',
        'users, credentials, secrets, orders, forms, logs, caches, and other personal data',
      ],
      extractionBoundary: 'approved root package.json, root database.sql, and candidate upload metadata only; temp directory outside repository',
      publicContentRule: 'upload candidates are not public by default and require reconciliation to published database records and live production evidence',
    },
  };

  if (options.manifest) {
    const manifestPath = resolve(options.manifest);
    mkdirSync(dirname(manifestPath), { recursive: true });
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        extraction: extractionDir
          ? {
              databaseSql: databaseDestination,
              directory: extractionDir,
              packageJson: packageDestination,
              uploadsMetadata: join(extractionDir, 'uploads-metadata.json'),
            }
          : null,
        manifest,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
