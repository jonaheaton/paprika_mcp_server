# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Model Context Protocol (MCP) server for connecting Claude to SQL databases, specifically designed to work with Paprika recipe management data. The project allows Claude to query and interact with your database in real-time during conversations.

## Development Commands

Currently, the project is in early development stage. Available commands:

- `npm start` - Start the MCP server (runs `node server.js`)
- `npm test` - Run tests (currently returns error message, no tests implemented)

Note: The main server implementation (`server.js`) does not exist yet - it needs to be created based on the example in the README.

## Architecture

### MCP Server Structure
- **Entry Point**: `server.js` (to be created) - Main MCP Server implementation
- **Database**: SQLite database located at `data/Paprika.sqlite`
- **Protocol**: Uses Model Context Protocol SDK for communication with Claude Desktop

### Key Components (as planned)
1. **SQLMCPServer Class**: Main server class handling MCP protocol
2. **Database Tools**: 
   - `query_sql` - Execute SQL queries with safety restrictions
   - `describe_tables` - Get schema information for all tables
   - `get_table_schema` - Get detailed schema for specific tables
3. **Safety Features**: Blocks destructive operations (DROP, DELETE, TRUNCATE)

### Database
- **Type**: SQLite 
- **Location**: `data/Paprika.sqlite`
- **Purpose**: Contains Paprika recipe management data including recipes, ingredients, categories, etc.

## Dependencies

- `@modelcontextprotocol/sdk`: Core MCP protocol implementation
- Database driver (to be added): `better-sqlite3` for SQLite support

## Installation & Setup

1. Install dependencies: `npm install`
2. Create the main server file (`server.js`) following the README example
3. Install database driver: `npm install better-sqlite3`
4. Install globally: `npm install -g .`
5. Configure Claude Desktop with the server configuration

## Claude Desktop Configuration

The server is designed to be configured in Claude Desktop's config file at:
`~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "paprika-database": {
      "command": "paprika-mcp-server",
      "args": []
    }
  }
}
```

## Development Notes

- Project is currently in setup phase - main implementation files need to be created
- Database exists and contains Paprika data ready for querying
- Follow the comprehensive README.md for implementation guidance
- Security is important: implement query restrictions to prevent data loss