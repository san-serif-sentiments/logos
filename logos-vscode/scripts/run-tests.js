#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');

const testRunner = path.resolve(__dirname, '../out/test/test/runTest.js');

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) {
    if (result.error.code === 'ENOENT') {
      throw new Error(`Unable to find required executable: ${command}`);
    }
    throw result.error;
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status);
  }
}

function hasDisplayServer() {
  return Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
}

function main() {
  try {
    if (process.platform === 'linux' && !hasDisplayServer()) {
      try {
        run('xvfb-run', ['-a', 'node', testRunner]);
        return;
      } catch (err) {
        if (err instanceof Error && err.message.includes('xvfb-run')) {
          console.error(
            'VS Code integration tests require a display server. Install xvfb (e.g. "sudo apt-get install xvfb") '
              + 'or run the tests from an environment with DISPLAY configured.'
          );
          process.exit(1);
        }
        throw err;
      }
    }

    run('node', [testRunner]);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
