import { Plugin } from 'vite';

/**
 * Configuration options for 0x-tagger plugin
 */
interface TaggerOptions {
    /**
     * Enable/disable the plugin
     * @default true in development, false in production
     */
    enabled?: boolean;
    /**
     * File patterns to include (glob patterns)
     * @default ['**\/*.{jsx,tsx}']
     */
    include?: string[];
    /**
     * File patterns to exclude
     * @default ['node_modules/**', 'dist/**', 'build/**']
     */
    exclude?: string[];
    /**
     * Attribute name for component ID
     * @default 'data-0x-component-id'
     */
    attributeName?: string;
    /**
     * Include file path attribute
     * @default true
     */
    includeFilePath?: boolean;
    /**
     * Include line number attribute
     * @default true
     */
    includeLineNumber?: boolean;
    /**
     * Root directory for relative paths
     * @default process.cwd()
     */
    rootDir?: string;
    /**
     * Enable debug logging
     * @default false
     */
    debug?: boolean;
}
/**
 * 0xminds Component Tagger - Vite Plugin
 *
 * This plugin automatically adds metadata attributes to JSX/TSX components
 * to enable design mode functionality.
 *
 * @example
 * ```typescript
 * // vite.config.ts
 * import { componentTagger } from '@0xminds/component-tagger';
 *
 * export default defineConfig({
 *   plugins: [
 *     react(),
 *     componentTagger({
 *       enabled: true,
 *       debug: true
 *     })
 *   ]
 * });
 * ```
 */
declare function componentTagger(userOptions?: TaggerOptions): Plugin;

export { type TaggerOptions, componentTagger, componentTagger as default };
