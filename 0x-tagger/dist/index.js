// src/index.ts
import { parse } from "@babel/parser";
import babelTraverse from "@babel/traverse";
import * as t from "@babel/types";
import MagicString from "magic-string";
import path from "path";
var traverse = babelTraverse.default || babelTraverse;
var DEFAULT_OPTIONS = {
  enabled: process.env.NODE_ENV === "development",
  include: ["**/*.{jsx,tsx}"],
  exclude: ["node_modules/**", "dist/**", "build/**", "**/ui/**"],
  attributeName: "data-0x-component-id",
  includeFilePath: true,
  includeLineNumber: true,
  rootDir: process.cwd(),
  debug: false
};
function shouldProcessFile(filePath, options) {
  if (!/\.(jsx|tsx)$/.test(filePath)) {
    return false;
  }
  const isExcluded = options.exclude.some((pattern) => {
    const normalizedPath = filePath.replace(/\\/g, "/");
    const normalizedPattern = pattern.replace(/\\/g, "/");
    const regexPattern = normalizedPattern.replace(/\*\*/g, "___DOUBLESTAR___").replace(/\*/g, "[^/]*").replace(/___DOUBLESTAR___/g, ".*").replace(/\?/g, ".");
    const regex = new RegExp(regexPattern);
    return regex.test(normalizedPath);
  });
  if (isExcluded && options.debug) {
    console.log(`[0x-tagger] Excluded: ${filePath}`);
  }
  return !isExcluded;
}
function generateComponentId(componentName, filePath, line, column) {
  const fileName = path.basename(filePath, path.extname(filePath));
  return `${componentName}_${fileName}_${line}_${column}`;
}
function getRelativeFilePath(filePath, rootDir) {
  return path.relative(rootDir, filePath);
}
function shouldTagElement(element) {
  if (t.isJSXFragment(element)) {
    return false;
  }
  const openingElement = element.openingElement;
  const hasAttribute = openingElement.attributes.some((attr) => {
    if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
      return attr.name.name.startsWith("data-0x-");
    }
    return false;
  });
  return !hasAttribute;
}
function transformCode(code, filePath, options) {
  try {
    const ast = parse(code, {
      sourceType: "module",
      plugins: [
        "jsx",
        "typescript",
        "classProperties",
        "decorators-legacy"
      ]
    });
    const s = new MagicString(code);
    const relativeFilePath = getRelativeFilePath(filePath, options.rootDir);
    let modified = false;
    traverse(ast, {
      JSXElement(nodePath) {
        const element = nodePath.node;
        if (!shouldTagElement(element)) {
          return;
        }
        const openingElement = element.openingElement;
        const elementName = t.isJSXIdentifier(openingElement.name) ? openingElement.name.name : "UnknownComponent";
        const loc = openingElement.loc;
        if (!loc) return;
        const line = loc.start.line;
        const column = loc.start.column;
        const componentId = generateComponentId(
          elementName,
          relativeFilePath,
          line,
          column
        );
        const nameEnd = openingElement.name.loc.end;
        let insertPos = code.indexOf(">", nameEnd.index);
        if (openingElement.attributes.length > 0) {
          const firstAttr = openingElement.attributes[0];
          insertPos = firstAttr.loc.start.index;
        } else {
          const isSelfClosing = code[insertPos - 1] === "/";
          if (isSelfClosing) {
            insertPos = insertPos - 1;
          }
        }
        const attributes = [];
        attributes.push(`${options.attributeName}="${componentId}"`);
        if (options.includeFilePath) {
          attributes.push(`data-0x-file="${relativeFilePath}"`);
        }
        if (options.includeLineNumber) {
          attributes.push(`data-0x-line="${line}"`);
          attributes.push(`data-0x-column="${column}"`);
        }
        attributes.push(`data-0x-component="${elementName}"`);
        const attributesStr = " " + attributes.join(" ");
        s.appendLeft(insertPos, attributesStr);
        modified = true;
        if (options.debug) {
          console.log(`[0x-tagger] Tagged <${elementName}> at ${relativeFilePath}:${line}:${column}`);
        }
      }
    });
    if (!modified) {
      return null;
    }
    return {
      code: s.toString(),
      map: s.generateMap({ hires: true })
    };
  } catch (error) {
    console.error(`[0x-tagger] Error transforming ${filePath}:`, error);
    return null;
  }
}
function componentTagger(userOptions = {}) {
  const options = {
    ...DEFAULT_OPTIONS,
    ...userOptions
  };
  return {
    name: "0x-component-tagger",
    enforce: "pre",
    configResolved(config) {
      if (userOptions.enabled === void 0) {
        options.enabled = config.mode === "development";
      }
      if (!userOptions.rootDir) {
        options.rootDir = config.root;
      }
      if (options.debug) {
        console.log("[0x-tagger] Plugin initialized with options:", {
          enabled: options.enabled,
          mode: config.mode,
          rootDir: options.rootDir
        });
      }
    },
    transform(code, id) {
      if (!options.enabled) {
        if (options.debug) {
          console.log(`[0x-tagger] Plugin disabled, skipping ${id}`);
        }
        return null;
      }
      const shouldProcess = shouldProcessFile(id, options);
      if (options.debug && id.includes(".tsx") || id.includes(".jsx")) {
        console.log(`[0x-tagger] Checking ${id}: shouldProcess=${shouldProcess}`);
      }
      if (!shouldProcess) {
        return null;
      }
      if (options.debug) {
        console.log(`[0x-tagger] \u2705 Processing ${id}`);
      }
      const result = transformCode(code, id, options);
      if (!result) {
        if (options.debug) {
          console.log(`[0x-tagger] \u26A0\uFE0F  No changes for ${id}`);
        }
        return null;
      }
      if (options.debug) {
        console.log(`[0x-tagger] \u2728 Transformed ${id}`);
      }
      return {
        code: result.code,
        map: result.map
      };
    }
  };
}
var index_default = componentTagger;
export {
  componentTagger,
  index_default as default
};
