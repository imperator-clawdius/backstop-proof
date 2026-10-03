import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(filename), '../..');
const mode = process.argv[2];

if (mode) {
  const { default: db } = await import('../../app/db.server.ts');
  try {
    // Refuse to connect a stale generated client to an unintended database.
    // The functional checks below use actual migrations, model writes and restarts.
    assert.equal(db._engineConfig.inlineDatasources.db.url.fromEnvVar, 'DATABASE_URL', 'Regenerate the client from the environment-backed datasource before connecting.');
    if (mode !== 'preflight') {
      const expectedFile = process.argv[3];
      const expectedLabel = process.argv[4];
      const databases = await db.$queryRawUnsafe('PRAGMA database_list');
      const main = databases.find(database => database.name === 'main');
      assert.equal(realpathSync(main.file), realpathSync(expectedFile), 'Application client opened a different SQLite file.');
      const shopDomain = 'database-location-fixture.example';
      if (mode === 'write') {
        assert.equal(await db.shop.count(), 0);
        await db.shop.create({ data: { shopDomain, accessScope: expectedLabel, settings: { fictional: true } } });
      } else {
        assert.equal(mode, 'read');
        assert.equal((await db.shop.findUniqueOrThrow({ where: { shopDomain } })).accessScope, expectedLabel);
        assert.equal(await db.shop.count(), 1);
      }
    }
    console.log(JSON.stringify({ check: mode, passed: true }));
  } finally {
    await db.$disconnect();
  }
} else {
  const fixture = mkdtempSync(path.join(tmpdir(), 'backstop-database-location-'));
  const baseEnv = Object.fromEntries(['SystemRoot', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'PATH', 'PATHEXT'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
  const envFor = file => ({ ...baseEnv, HOME: fixture, USERPROFILE: fixture, NODE_ENV: 'production', DATABASE_URL: `file:${file.replaceAll('\\', '/')}`, PRISMA_HIDE_UPDATE_MESSAGE: '1', CHECKPOINT_DISABLE: '1' });
  function run(args, file) {
    const child = spawnSync(process.execPath, args, { cwd: root, env: envFor(file), timeout: 30000, encoding: 'utf8', windowsHide: true });
    assert.equal(child.error, undefined, child.error?.message);
    assert.equal(child.status, 0, child.stderr || child.stdout);
  }
  const files = ['first selected.sqlite', 'second selected.sqlite'].map(name => path.join(fixture, name));
  try {
    // Even a regressed literal URL can only create a file in this owned fixture.
    const schemaDirectory = path.join(fixture, 'prisma');
    mkdirSync(schemaDirectory);
    cpSync(path.join(root, 'prisma/schema.prisma'), path.join(schemaDirectory, 'schema.prisma'));
    cpSync(path.join(root, 'prisma/migrations'), path.join(schemaDirectory, 'migrations'), { recursive: true });
    run(['--experimental-strip-types', filename, 'preflight'], files[0]);
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      run([path.join(root, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy', '--schema', path.join(schemaDirectory, 'schema.prisma')], file);
      assert.ok(existsSync(file), 'Migration CLI ignored the configured database location.');
      run(['--experimental-strip-types', filename, 'write', file, String(index)], file);
      run(['--experimental-strip-types', filename, 'read', file, String(index)], file);
    }
    // Reopen the first database after using the second: configuration must not mix data.
    run(['--experimental-strip-types', filename, 'read', files[0], '0'], files[0]);
    console.log(JSON.stringify({ passed: true, databases: 2, migrations: 'actual', applicationClient: 'actual', restartReads: 3, providers: false, networkListeners: false }));
  } finally {
    const resolved = realpathSync(fixture);
    const parent = realpathSync(tmpdir());
    assert.equal(path.dirname(resolved), parent);
    assert.ok(path.basename(resolved).startsWith('backstop-database-location-'));
    rmSync(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}
