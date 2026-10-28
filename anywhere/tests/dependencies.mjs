import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const local = createRequire(import.meta.url);
export function dependency(name) {
  try { return local(name); } catch (error) {
    // Offline validation can reuse explicitly supplied installed modules, without copying or modifying them.
    if (!process.env.ANYWHERE_NODE_MODULES) throw error;
    return createRequire(resolve(process.env.ANYWHERE_NODE_MODULES, '../package.json'))(name);
  }
}
