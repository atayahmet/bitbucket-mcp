# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
npm run build          # Production bundle with Vite (dist/index.js)
npm run dev            # Build in watch mode
npm start              # Run the compiled server (node dist/index.js)
npm test               # Vitest test suite
docker build -t bitbucket-mcp .   # Build Docker image
```

## Architecture

The MCP server acts as a stdio-based bridge between Claude and Bitbucket REST API v2.0.

**3-layer structure:**

- **`src/index.ts`** — `BitbucketServer` class. MCP tool definitions (inputSchema) and switch-case handlers for routing tool calls. When adding a new tool, add both the definition to the `ListToolsRequestSchema` handler and a case to the `CallToolRequestSchema` handler.
- **`src/bitbucket-api.ts`** — `BitbucketClient` class. API client using Axios with basic auth. Each MCP tool corresponds to an async method here.
- **`src/types.ts`** — TypeScript interfaces for Bitbucket API responses.

**New tool workflow:** types.ts interface → bitbucket-api.ts method → index.ts tool definition + case handler → add to the "Tools" section in README.md under the relevant category.

## Environment

- `BITBUCKET_EMAIL` and `BITBUCKET_TOKEN` env variables are required (app password).
- Docker multi-stage build: compilation in builder stage, only production deps in runtime stage.
- TypeScript strict mode enabled (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- ESM module system (`"type": "module"`), bundled into a single file with Vite.
