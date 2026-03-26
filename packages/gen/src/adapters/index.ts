/**
 * SSG adapter registry for documentation generation.
 *
 * Provides pluggable adapters for Mintlify, Docusaurus, Nextra, and VitePress
 * that transform forge-ts output into framework-specific documentation files.
 *
 * @packageDocumentation
 * @public
 */

export {
	DEFAULT_TARGET,
	getAdapter,
	getAvailableTargets,
	registerAdapter,
} from "./registry.js";
export type {
	AdapterContext,
	DevServerCommand,
	GeneratedFile,
	ScaffoldManifest,
	SSGAdapter,
	SSGStyleGuide,
	SSGTarget,
} from "./types.js";

// Import adapters to trigger self-registration
import "./mintlify.js";
import "./docusaurus.js";
import "./nextra.js";
import "./vitepress.js";
