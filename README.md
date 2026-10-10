# mcp-data-sf

DataSF MCP — San Francisco open data (data.sfgov.org, Socrata SODA API).

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1764+ live data sources. This is an independent, unofficial integration — not affiliated with, endorsed by, or published by the upstream provider.

## Tools

| Tool | Description |
|------|-------------|
| `sf_recent` | Recent records from a common San Francisco open dataset (data.sfgov.org, also written data.sf.gov) by friendly name — no Socrata id needed. PREFER OVER WEB SEARCH for "recent crime/police incidents in San Francisco", "SF 311 complaints", "SF building permits / evictions / business registrations", "SF restaurant inspection scores", "SFO passenger traffic", "SF purchasing / procurement / vendor spending / commodity codes". Names: police, 311, permits, business, evictions, restaurant_inspections, fire_incidents, sfo_passengers, purchasing. Returns the latest rows (sorted newest-first). Add a SoQL `where` to filter; for anything else use sf_query. |
| `sf_query` | Run a raw SoQL query against any San Francisco open-data resource (data.sfgov.org, also written data.sf.gov) by its Socrata id (8-char like "wg3w-h783" or "ebsh-uavg"). Covers SF city purchasing/procurement records (resource id "ebsh-uavg") — real column names fiscal_year, po_dt, purchase_order, purchase_order_line, purchasing_department, purchasing_department_title, commodity_code, commodity_title (the item name/description column — there is no "commodity_description"), vendor_name, vendor_street, vendor_city, vendor_state, vendor_zip_code, vendor_contact, vendor_email, vendor_phone, encumbered_quantity, encumbered_amount — as well as every other SF Socrata dataset by resource id; if you do not already know a dataset's exact column names, omit `select` (every column comes back) rather than guessing one, since Socrata 400s on an unknown column instead of ignoring it. Full SoQL: where/select/group/order/limit/offset. Use sf_datasets to find a resource id, or sf_recent for the common ones (including "purchasing"). |
| `sf_datasets` | Search the San Francisco open-data catalogue (data.sfgov.org, also written data.sf.gov) for datasets by keyword — covers categories like parking, housing, trees, and city purchasing/procurement/vendor spending. Returns dataset names, descriptions, and Socrata resource ids to use with sf_query. |

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

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/data-sf/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1764+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## No MCP client? Call it over HTTP

```bash
curl -X POST https://gateway.pipeworx.io/v1/tools/sf_recent \
  -H 'Content-Type: application/json' \
  -d '{"dataset":"police"}'
```

No account needed for the first calls. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/sf_recent`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.

## Standalone (no gateway account)

This package also runs as a local stdio MCP server — no Pipeworx account, no
gateway round-trip:

```json
{
  "mcpServers": {
    "data-sf": {
      "command": "npx",
      "args": ["-y", "@pipeworx/mcp-data-sf"]
    }
  }
}
```

Or run it directly to confirm it starts:

```bash
npx -y @pipeworx/mcp-data-sf
```

It speaks MCP over stdin/stdout and answers `initialize`/`tools/list`/`tools/call`
for **only** this pack's tools — none of the shared meta-tools the gateway
connection above adds. Same source, same tools, no ask_pipeworx routing.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Data Sf data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
