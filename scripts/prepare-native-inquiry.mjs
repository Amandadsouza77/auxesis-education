// Prepare a verified private runtime locally. No network, deployment or data writes.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha = content => createHash('sha256').update(content).digest('hex');
const require = (condition, message) => { if (!condition) throw Error(message); };

export function prepareNativeInquiry(directory) {
  const root = resolve(directory);
  require(root !== source, 'Use the recovered native runtime directory, not the repository.');
  const manifest = JSON.parse(readFileSync(resolve(root, 'deployment-manifest.json'), 'utf8'));
  require(manifest.origin === 'https://migration-auth.auxesis-production-staging.pages.dev' &&
    manifest.databaseId === '4f12fc1d-3e0d-4a11-bd65-e577ce906114' &&
    manifest.apply === false && manifest.automation === false && manifest.cutover === false,
    'Unexpected private runtime manifest.');
  require(existsSync(resolve(root, 'staging-entry.js')) && existsSync(resolve(root, 'dist/_worker.js')),
    'Native worker source and built worker are required.');

  const currentApp = readFileSync(resolve(root, 'dist/app.js'), 'utf8');
  const forms = currentApp.match(/^const forms=.+;$/m)?.[0];
  require(forms, 'Unrecognised native form bootstrap.');
  // The native release removed the legacy review bootstrap. Preserve that choice.
  const updatedApp = readFileSync(resolve(source, 'public/app.js'), 'utf8')
    .replace(/^const forms=.+;$/m, () => forms);
  const supported = [
    '0b40b93096efe8cb6ed77a286e837d5cf483218188d2735ab5bf146fb299ab07',
    'f076c2cd5bed4be6a5c963a1cfd5bef86e83c708ef3adf112fd737c9a55e6cb6',
    sha(updatedApp),
  ];
  require(supported.includes(sha(currentApp)), 'Native app.js has newer changes; compare before applying.');

  const writes = {
    'inquiry/lib/server.js': readFileSync(resolve(source, 'lib/server.js'), 'utf8'),
    'inquiry/cloudflare/inquiry-worker.js': readFileSync(resolve(source, 'cloudflare/inquiry-worker.js'), 'utf8'),
    'inquiry-entry.js': "import nativeWorker from './staging-entry.js';\nimport {withInquiry} from './inquiry/cloudflare/inquiry-worker.js';\nexport default withInquiry(nativeWorker);\n",
    'dist/app.js': updatedApp,
  };
  for (const [path, content] of Object.entries(writes)) {
    mkdirSync(dirname(resolve(root, path)), { recursive: true });
    writeFileSync(resolve(root, path), content);
  }
  return { entry: resolve(root, 'inquiry-entry.js'), files: Object.keys(writes) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    require(process.argv.length === 3, 'Usage: node scripts/prepare-native-inquiry.mjs VERIFIED_RUNTIME_DIRECTORY');
    console.log(JSON.stringify(prepareNativeInquiry(process.argv[2])));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
