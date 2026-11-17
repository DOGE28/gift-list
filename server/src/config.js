import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(path.join(__dirname, '..', '..'));

export const port = parseInt(process.env.PORT || '8585', 10);
export const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-me';
export const cookieSecure = process.env.COOKIE_SECURE === 'true';
export const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(projectRoot, 'data');
export const dbFile = path.join(dataDir, 'gift-list.db');
export const webDist = process.env.WEB_DIST
  ? path.resolve(process.env.WEB_DIST)
  : (fs.existsSync(path.join(projectRoot, 'public'))
    ? path.join(projectRoot, 'public')
    : path.join(projectRoot, 'web', 'dist'));
