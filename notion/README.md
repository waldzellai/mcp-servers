# Notion MCP Server (TypeScript)

A Model Context Protocol (MCP) server for Notion, written in TypeScript. This server provides comprehensive access to Notion's API, enabling AI assistants to interact with Notion databases, pages, blocks, and search functionality.

## Features

- **Database Operations**: List, query, create, and update Notion databases
- **Page Operations**: Retrieve, create, and update Notion pages
- **Block Operations**: Get blocks, retrieve block children, append blocks, and update block content
- **Search**: Search across all accessible pages and databases
- **Full TypeScript Support**: Type-safe implementations with proper error handling

## Installation

1. Clone or copy this directory
2. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

Set your Notion API key as an environment variable:

```bash
export NOTION_API_KEY="your_notion_integration_token"
```

You can also create a `.env` file:

```
NOTION_API_KEY=your_notion_integration_token
```

## Usage

### Development

Run in development mode with hot reload:

```bash
npm run dev
```

### Production

Build and run:

```bash
npm run build
npm start
```

## Available Tools

### Database Tools

- `list_databases` - List all databases the integration has access to
- `query_database` - Query a database with optional filtering, sorting, and pagination
- `create_database` - Create a new database in a parent page
- `update_database` - Update an existing database's title, description, or properties

### Page Tools

- `get_page` - Retrieve a page by its ID
- `create_page` - Create a new page in a database or as a child of another page
- `update_page` - Update an existing page's properties or archive status

### Block Tools

- `get_block` - Retrieve a block by its ID
- `get_block_children` - Retrieve the children blocks of a block (page or block)
- `append_block_children` - Append blocks to a parent block (page or block)
- `update_block` - Update a block's content or archive status

### Search Tools

- `search` - Search across all pages and databases that the integration has access to

## Getting a Notion API Key

1. Go to [Notion Developers](https://developers.notion.com/)
2. Click "Create new integration"
3. Give your integration a name and select the workspace
4. Copy the "Internal Integration Token" (starts with `secret_`)
5. Share the databases/pages you want to access with your integration

## Architecture

This server follows a modular architecture:

- `src/index.ts` - Main server setup and configuration
- `src/tools/` - Individual tool implementations organized by functionality
  - `databases.ts` - Database-related operations
  - `pages.ts` - Page-related operations
  - `blocks.ts` - Block-related operations
  - `search.ts` - Search functionality

## Error Handling

All tools include comprehensive error handling and return user-friendly error messages when operations fail. The server validates input parameters using Zod schemas.

## Contributing

This server is designed to be easily extensible. To add new tools:

1. Create a new tool file in `src/tools/`
2. Implement your tool functions following the existing patterns
3. Register your tools in `src/index.ts`

## License

This project follows the same license as the Smithery MCP servers collection.
