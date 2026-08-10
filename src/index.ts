/**
 * Root entry point. Re-exports every module so consumers can either pull the
 * whole surface from here, or import a single module by subpath and let their
 * bundler drop the rest.
 *
 * Relative imports carry an explicit `.js` extension. That is required for the
 * ESM build to resolve at runtime, and is accepted by the CommonJS build too —
 * omitting it produces an ESM bundle that silently fails to load.
 */

export { Deadline, validate } from './deadline/index.js';
