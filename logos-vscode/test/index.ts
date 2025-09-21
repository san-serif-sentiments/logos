import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export async function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'bdd',
    color: true,
    timeout: 10000,
  });

  const testsRoot = path.resolve(__dirname);

  const files = await glob('**/*.test.js', { cwd: testsRoot });

  for (const file of files) {
    mocha.addFile(path.resolve(testsRoot, file));
  }

  await new Promise<void>((resolve, reject) => {
    mocha.run(failures => {
      if (failures > 0) {
        reject(new Error(`${failures} tests failed`));
      } else {
        resolve();
      }
    });
  });
}
