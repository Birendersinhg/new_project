// Lets Node run the app's .ts modules in tests: resolves extension-less relative imports ("./matka") to ".ts".
import { register } from 'node:module';

const hook = `export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); } catch (err) {
    if (spec.startsWith('.') && !/\.\w+$/.test(spec)) return next(spec + '.ts', ctx);
    throw err;
  }
}`;
register('data:text/javascript,' + encodeURIComponent(hook), import.meta.url);
