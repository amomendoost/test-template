# @0xminds/component-tagger

A Vite plugin that automatically adds metadata attributes to React/JSX components to enable Design Mode functionality in the 0xminds platform.

## Features

✅ **Automatic Component Tagging**: Adds unique IDs to every JSX element
✅ **File & Line Tracking**: Tracks source file and line number for each component
✅ **TypeScript Support**: Full TypeScript support with type definitions
✅ **Smart Filtering**: Excludes node_modules, dist, and UI library components
✅ **Development-Only**: Automatically disabled in production builds
✅ **Zero Runtime Overhead**: Pure build-time transformation
✅ **Source Maps**: Preserves source maps for debugging

## Installation

```bash
npm install @0xminds/component-tagger --save-dev
```

## Usage

### Basic Setup

Add the plugin to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { componentTagger } from '@0xminds/component-tagger';

export default defineConfig({
  plugins: [
    react(),
    componentTagger(), // Add this line
  ],
});
```

### With Custom Options

```typescript
import { componentTagger } from '@0xminds/component-tagger';

export default defineConfig({
  plugins: [
    react(),
    componentTagger({
      enabled: true,              // Force enable (default: auto-detect from mode)
      debug: true,                // Enable debug logging
      include: ['**/*.{jsx,tsx}'], // Files to process
      exclude: ['**/ui/**'],      // Files to exclude
      attributeName: 'data-0x-component-id', // Custom attribute name
    }),
  ],
});
```

## How It Works

### Before Transformation

```jsx
function MyComponent() {
  return (
    <div className="container">
      <h1>Hello World</h1>
      <Button variant="primary">Click Me</Button>
    </div>
  );
}
```

### After Transformation

```jsx
function MyComponent() {
  return (
    <div
      data-0x-component-id="div_MyComponent_3_5"
      data-0x-file="src/components/MyComponent.tsx"
      data-0x-line="3"
      data-0x-column="5"
      data-0x-component="div"
      className="container"
    >
      <h1
        data-0x-component-id="h1_MyComponent_4_7"
        data-0x-file="src/components/MyComponent.tsx"
        data-0x-line="4"
        data-0x-column="7"
        data-0x-component="h1"
      >
        Hello World
      </h1>
      <Button
        data-0x-component-id="Button_MyComponent_5_7"
        data-0x-file="src/components/MyComponent.tsx"
        data-0x-line="5"
        data-0x-column="7"
        data-0x-component="Button"
        variant="primary"
      >
        Click Me
      </Button>
    </div>
  );
}
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `auto` | Enable/disable the plugin (auto = dev only) |
| `include` | `string[]` | `['**/*.{jsx,tsx}']` | File patterns to include |
| `exclude` | `string[]` | `['node_modules/**', 'dist/**', '**/ui/**']` | File patterns to exclude |
| `attributeName` | `string` | `'data-0x-component-id'` | Main attribute name |
| `includeFilePath` | `boolean` | `true` | Add file path attribute |
| `includeLineNumber` | `boolean` | `true` | Add line number attribute |
| `rootDir` | `string` | `process.cwd()` | Root directory for relative paths |
| `debug` | `boolean` | `false` | Enable debug logging |

## Generated Attributes

Each tagged component receives the following attributes:

- **`data-0x-component-id`**: Unique identifier (format: `ComponentName_FileName_Line_Column`)
- **`data-0x-file`**: Relative file path from project root
- **`data-0x-line`**: Line number in source file
- **`data-0x-column`**: Column number in source file
- **`data-0x-component`**: Component/element name

## Use Cases

This plugin is designed for:

- 🎨 **Design Mode**: Click-to-edit functionality in visual builders
- 🔍 **Component Inspector**: Identify components in rendered output
- 🐛 **Debugging**: Track component source locations
- 📊 **Analytics**: Component usage tracking
- 🧪 **Testing**: Element selection in E2E tests

## Performance

- **Zero Runtime Impact**: All transformations happen at build time
- **Smart Caching**: Only processes changed files
- **Production Safe**: Automatically disabled in production builds
- **Source Maps**: Maintains accurate source maps for debugging

## Compatibility

- ✅ Vite 5.x and above
- ✅ React 18+
- ✅ TypeScript 5+
- ✅ JSX/TSX files
- ✅ All modern browsers

## Troubleshooting

### Plugin not working?

1. Check that `mode` is set to `'development'` in Vite config
2. Verify file matches `include` patterns and not in `exclude`
3. Enable `debug: true` to see transformation logs
4. Check console for error messages

### Attributes not appearing?

Make sure:
- Plugin is listed **before** React plugin in Vite config
- Files are not in excluded directories (`node_modules`, `dist`, `ui`)
- Build cache is cleared: `rm -rf node_modules/.vite`

### TypeScript errors?

Install type definitions:
```bash
npm install --save-dev @types/babel__core @types/babel__traverse
```

## Examples

See the `examples/` directory for complete working examples:

- Basic React app
- TypeScript project
- shadcn/ui integration
- Next.js (experimental)

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## License

MIT © 0xminds

## Support

- 📧 Email: support@0xminds.com
- 🐛 Issues: [GitHub Issues](https://github.com/0xminds/0x-tagger/issues)
- 📖 Docs: [Full Documentation](https://docs.0xminds.com/tagger)

---

Made with ❤️ by the 0xminds team
