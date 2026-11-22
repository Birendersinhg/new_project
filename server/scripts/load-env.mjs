// Loads server/.env when it exists. Using --env-file-if-exists together with --watch
// crashes Node when the file is missing, so it is loaded here instead.
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');
