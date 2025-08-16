# Fixed Paprika MCP Extension - Installation Guide

## 🔧 Issues Fixed

1. **Node.js Path Issue**: Updated manifest to use absolute path to nvm-managed Node.js
2. **Log Directory Issue**: Fixed audit logging to use correct relative paths instead of absolute root paths

## 📦 Installation Steps

### 1. Uninstall Current Extension
- Open Claude Desktop Settings
- Go to Extensions section
- Remove the existing "Paprika Recipe Manager" extension

### 2. Install Fixed Extension
- Use the new `paprika_mcp_server.dxt` file (dated August 16, 2025)
- Drag and drop the DXT file onto Claude Desktop, or
- Use the "Install Extension" button in Claude Desktop settings

### 3. Configure Extension
- **Database Path**: Point to your `Paprika.sqlite` file location
- **Debug Mode**: Set to `false` for normal operation
- **Other settings**: Use defaults unless you have specific needs

## 🧪 Test Connection
After installation, try asking Claude:
- "Search for chicken recipes"
- "What categories do I have?"
- "Show me my recent recipes"

## 🔍 Troubleshooting

### If the extension still fails:
1. Check that your database path is correct
2. Ensure the `Paprika.sqlite` file is accessible
3. Restart Claude Desktop after installation

### Alternative Local Setup
If the DXT extension continues to have issues, you can set up a local MCP server:

1. Copy the included `claude_desktop_config.json` to your Claude Desktop config location
2. Update the paths in the config file to match your system
3. Restart Claude Desktop

## ✅ What Should Work Now
- Server starts without crashing
- All 10 read-only tools available
- Full access to your 826+ recipe database
- Meal planning, grocery lists, and pantry features
- Natural language recipe queries

The server is now stable and ready for production use!