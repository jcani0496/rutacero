/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');

const configPath = path.join(
  process.cwd(),
  'android',
  'app',
  'src',
  'main',
  'assets',
  'capacitor.config.json'
);

function readConfig() {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Missing Capacitor Android config at ${configPath}`);
  }

  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function writeConfig(config) {
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, '\t')}\n`);
}

function main() {
  const config = readConfig();
  const desiredServerUrl = process.env.CAPACITOR_SERVER_URL?.trim();
  const nextServer = config.server && typeof config.server === 'object' ? { ...config.server } : null;

  if (desiredServerUrl) {
    config.server = {
      ...nextServer,
      url: desiredServerUrl,
      cleartext: desiredServerUrl.startsWith('http://'),
    };

    writeConfig(config);
    console.log(`Sanitized Capacitor Android config with server URL ${desiredServerUrl}`);
    return;
  }

  if (!nextServer || !('url' in nextServer) && !('cleartext' in nextServer)) {
    console.log('Capacitor Android config already has no injected server URL');
    return;
  }

  delete nextServer.url;
  delete nextServer.cleartext;

  if (Object.keys(nextServer).length === 0) {
    delete config.server;
  } else {
    config.server = nextServer;
  }

  writeConfig(config);
  console.log('Removed injected server URL from Capacitor Android config');
}

main();
