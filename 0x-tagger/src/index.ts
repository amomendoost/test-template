import { parse } from '@babel/parser';
import babelTraverse, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import MagicString from 'magic-string';
import type { Plugin } from 'vite';
import path from 'path';

// Handle both CJS and ESM imports
// @ts-ignore
const traverse = babelTraverse.default || babelTraverse;

/**
 * Configuration options for 0x-tagger plugin
 */
export interface TaggerOptions {
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
 * Default configuration
 */
const DEFAULT_OPTIONS: Required<TaggerOptions> = {
  enabled: process.env.NODE_ENV === 'development',
  include: ['**/*.{jsx,tsx}'],
  exclude: ['node_modules/**', 'dist/**', 'build/**', '**/ui/**'],
  attributeName: 'data-0x-component-id',
  includeFilePath: true,
  includeLineNumber: true,
  rootDir: process.cwd(),
  debug: false,
};

/**
 * Check if file should be processed
 */
function shouldProcessFile(filePath: string, options: Required<TaggerOptions>): boolean {
  // Only process .jsx and .tsx files
  if (!/\.(jsx|tsx)$/.test(filePath)) {
    return false;
  }

  // Check if file matches exclude patterns
  const isExcluded = options.exclude.some(pattern => {
    // Normalize path separators
    const normalizedPath = filePath.replace(/\\/g, '/');
    const normalizedPattern = pattern.replace(/\\/g, '/');

    // Convert glob pattern to regex
    const regexPattern = normalizedPattern
      .replace(/\*\*/g, '___DOUBLESTAR___')
      .replace(/\*/g, '[^/]*')
      .replace(/___DOUBLESTAR___/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp(regexPattern);
    return regex.test(normalizedPath);
  });

  if (isExcluded && options.debug) {
    console.log(`[0x-tagger] Excluded: ${filePath}`);
  }

  return !isExcluded;
}

/**
 * Generate unique component ID
 */
function generateComponentId(
  componentName: string,
  filePath: string,
  line: number,
  column: number
): string {
  const fileName = path.basename(filePath, path.extname(filePath));
  return `${componentName}_${fileName}_${line}_${column}`;
}

/**
 * Get relative file path
 */
function getRelativeFilePath(filePath: string, rootDir: string): string {
  return path.relative(rootDir, filePath);
}

/**
 * Check if JSX element should be tagged
 */
function shouldTagElement(element: t.JSXElement | t.JSXFragment): boolean {
  // Don't tag fragments
  if (t.isJSXFragment(element)) {
    return false;
  }

  // Don't tag if already has our attribute
  const openingElement = element.openingElement;
  const hasAttribute = openingElement.attributes.some(attr => {
    if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
      return attr.name.name.startsWith('data-0x-');
    }
    return false;
  });

  return !hasAttribute;
}

/**
 * Create JSX attribute (utility for future use)
 */
// Commented out - reserved for future enhancements
// function createJSXAttribute(name: string, value: string): t.JSXAttribute {
//   return t.jsxAttribute(
//     t.jsxIdentifier(name),
//     t.stringLiteral(value)
//   );
// }

/**
 * Transform code to add component tags
 */
function transformCode(
  code: string,
  filePath: string,
  options: Required<TaggerOptions>
): { code: string; map: any } | null {
  try {
    // Parse the code
    const ast = parse(code, {
      sourceType: 'module',
      plugins: [
        'jsx',
        'typescript',
        'classProperties',
        'decorators-legacy',
      ],
    });

    const s = new MagicString(code);
    const relativeFilePath = getRelativeFilePath(filePath, options.rootDir);
    let modified = false;

    // Traverse AST and add attributes to JSX elements
    traverse(ast, {
      JSXElement(nodePath: NodePath<t.JSXElement>) {
        const element = nodePath.node;

        if (!shouldTagElement(element)) {
          return;
        }

        const openingElement = element.openingElement;
        const elementName = t.isJSXIdentifier(openingElement.name)
          ? openingElement.name.name
          : 'UnknownComponent';

        // Get position info
        const loc = openingElement.loc;
        if (!loc) return;

        const line = loc.start.line;
        const column = loc.start.column;

        // Generate component ID
        const componentId = generateComponentId(
          elementName,
          relativeFilePath,
          line,
          column
        );

        // Find insertion point (after element name, before first attribute or closing >)
        const nameEnd = openingElement.name.loc!.end;
        let insertPos = code.indexOf('>', nameEnd.index);

        // If there are attributes, insert before first attribute
        if (openingElement.attributes.length > 0) {
          const firstAttr = openingElement.attributes[0];
          insertPos = firstAttr.loc!.start.index;
        } else {
          // Check for self-closing
          const isSelfClosing = code[insertPos - 1] === '/';
          if (isSelfClosing) {
            insertPos = insertPos - 1;
          }
        }

        // Build attributes string
        const attributes: string[] = [];

        // Main component ID
        attributes.push(`${options.attributeName}="${componentId}"`);

        // File path
        if (options.includeFilePath) {
          attributes.push(`data-0x-file="${relativeFilePath}"`);
        }

        // Line number
        if (options.includeLineNumber) {
          attributes.push(`data-0x-line="${line}"`);
          attributes.push(`data-0x-column="${column}"`);
        }

        // Component name
        attributes.push(`data-0x-component="${elementName}"`);

        const attributesStr = ' ' + attributes.join(' ');

        // Insert attributes
        s.appendLeft(insertPos, attributesStr);
        modified = true;

        if (options.debug) {
          console.log(`[0x-tagger] Tagged <${elementName}> at ${relativeFilePath}:${line}:${column}`);
        }
      },
    });

    if (!modified) {
      return null;
    }

    return {
      code: s.toString(),
      map: s.generateMap({ hires: true }),
    };
  } catch (error) {
    console.error(`[0x-tagger] Error transforming ${filePath}:`, error);
    return null;
  }
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
export function componentTagger(userOptions: TaggerOptions = {}): Plugin {
  const options: Required<TaggerOptions> = {
    ...DEFAULT_OPTIONS,
    ...userOptions,
  };

  return {
    name: '0x-component-tagger',
    enforce: 'pre',

    configResolved(config) {
      // Auto-detect environment if not explicitly set
      if (userOptions.enabled === undefined) {
        options.enabled = config.mode === 'development';
      }

      // Use Vite's root as rootDir if not specified
      if (!userOptions.rootDir) {
        options.rootDir = config.root;
      }

      if (options.debug) {
        console.log('[0x-tagger] Plugin initialized with options:', {
          enabled: options.enabled,
          mode: config.mode,
          rootDir: options.rootDir,
        });
      }
    },

    transform(code, id) {
      // Skip if plugin is disabled
      if (!options.enabled) {
        if (options.debug) {
          console.log(`[0x-tagger] Plugin disabled, skipping ${id}`);
        }
        return null;
      }

      // Check if file should be processed
      const shouldProcess = shouldProcessFile(id, options);

      if (options.debug && id.includes('.tsx') || id.includes('.jsx')) {
        console.log(`[0x-tagger] Checking ${id}: shouldProcess=${shouldProcess}`);
      }

      if (!shouldProcess) {
        return null;
      }

      if (options.debug) {
        console.log(`[0x-tagger] ✅ Processing ${id}`);
      }

      // Transform the code
      const result = transformCode(code, id, options);

      if (!result) {
        if (options.debug) {
          console.log(`[0x-tagger] ⚠️  No changes for ${id}`);
        }
        return null;
      }

      if (options.debug) {
        console.log(`[0x-tagger] ✨ Transformed ${id}`);
      }

      return {
        code: result.code,
        map: result.map,
      };
    },
  };
}

/**
 * Export default
 */
export default componentTagger;
