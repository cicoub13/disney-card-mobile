// Hook de résolution : permet d'importer "./cards" (sans extension) depuis les sources TS du projet.
import { register } from 'node:module';

const hook = `
export async function resolve(specifier, context, next) {
  try { return await next(specifier, context); }
  catch (e) {
    if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(specifier + '.ts', context);
    throw e;
  }
}`;
register('data:text/javascript,' + encodeURIComponent(hook));
