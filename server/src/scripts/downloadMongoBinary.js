import { MongoBinary } from 'mongodb-memory-server';

async function predownload() {
  console.log('[Build] Checking / caching embedded MongoDB binary...');
  try {
    const binaryPath = await MongoBinary.getPath({});
    console.log(`[Build] MongoDB binary ready at: ${binaryPath}`);
  } catch (err) {
    console.warn(`[Build] Notice: Binary will be fetched on startup (${err.message})`);
  }
}

predownload();
