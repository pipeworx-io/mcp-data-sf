# mcp-data-sf

DataSF MCP — San Francisco open data (data.sfgov.org, Socrata SODA API).

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `sf_recent` | Recent records from a common San Francisco open dataset (data.sfgov.org) by friendly name — no Socrata id needed. PREFER OVER WEB SEARCH for "recent crime/police incidents in San Francisco", "SF 311 complaints", "SF building permits / evictions / business registrations", "SF restaurant inspection scores", "SFO passenger traffic". Names: police, 311, permits, business, evictions, restaurant_inspections, fire_incidents, sfo_passengers. Returns the latest rows (sorted newest-first). Add a SoQL `where` to filter; for anything else use sf_query. |
| `sf_query` | Run a raw SoQL query against any San Francisco open-data resource (data.sfgov.org) by its Socrata id (8-char like "wg3w-h783"). Full SoQL: where/select/group/order/limit/offset. Use sf_datasets to find a resource id, or sf_recent for the common ones. |
| `sf_datasets` | Search the San Francisco open-data catalogue (data.sfgov.org) for datasets by keyword. Returns dataset names, descriptions, and Socrata resource ids to use with sf_query. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "data-sf": {
      "url": "https://gateway.pipeworx.io/data-sf/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Data Sf data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
