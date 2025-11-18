# Configuration Directory

This directory contains all build-time and development configuration files for the SongStudio project.

## Files in this Directory

### Build & Dev Tools
- **`vite.config.ts`** - Vite bundler configuration (dev server, build settings, test config)
- **`postcss.config.js`** - PostCSS configuration for CSS processing
- **`tailwind.config.js`** - Tailwind CSS utility framework configuration
- **`eslint.config.js`** - ESLint linter configuration and rules

### TypeScript Configurations
- **`tsconfig.json`** - Base TypeScript configuration with project references
- **`tsconfig.app.json`** - Frontend app TypeScript configuration
- **`tsconfig.node.json`** - Node.js/build tools TypeScript configuration
- **`tsconfig.server.json`** - Backend server TypeScript configuration

## Root Proxy Files

To maintain compatibility with tools that expect configuration files at the project root, there are small proxy files that re-export from this directory:

```
project-root/
  ├── vite.config.ts       → imports from config/vite.config.ts
  ├── postcss.config.js    → imports from config/postcss.config.js
  ├── tailwind.config.js   → imports from config/tailwind.config.js
  ├── eslint.config.js     → imports from config/eslint.config.js
  └── tsconfig.json        → extends config/tsconfig.json
```

This approach gives you:
- ✅ Clean organization with all configs in one place
- ✅ Full IDE support and auto-completion
- ✅ Compatibility with all build tools
- ✅ No need for custom `--config` flags in most cases

## Important Notes

1. **Path Resolution**: Since configs are accessed via root proxy files, paths in these configs are resolved relative to the project root, not relative to this config directory.

2. **TypeScript Paths**: The TypeScript configs use relative paths (e.g., `../src`) because they are physically located in the config directory.

3. **Editing**: Edit the files in this directory, not the proxy files at the root.

4. **Build Server**: The `build:server` npm script uses `--project config/tsconfig.server.json` to build the backend.

## Usage

All npm scripts work normally:
```bash
npm run dev          # Start Vite dev server
npm run build        # Build for production
npm run lint         # Run ESLint
npm test            # Run tests
```

The build tools will automatically discover configurations through the root proxy files.

