interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * DataSF MCP — San Francisco open data (data.sfgov.org, Socrata SODA API).
 *
 * Keyless (rate-limited; pass an app token via _apiKey for higher limits).
 * Sister to data-cityofchicago / data-ny. Adds agent-friendly NAMED shortcuts
 * for the most-requested SF datasets so an LLM doesn't need Socrata resource
 * IDs, plus a generic SoQL escape hatch and a catalogue search.
 *
 * Tools:
 * - sf_recent:   recent rows from a common SF dataset by friendly name
 * - sf_query:    raw SoQL query against any data.sfgov.org resource id
 * - sf_datasets: search the SF open-data catalogue
 */


const BASE = 'https://data.sfgov.org';
const UA = 'pipeworx-mcp-data-sf/1.0 (+https://pipeworx.io)';

// Friendly name -> Socrata resource id + the date column to sort "recent" by.
const DATASETS: Record<string, { id: string; label: string; date: string }> = {
  police: { id: 'wg3w-h783', label: 'Police Department Incident Reports (2018–present)', date: 'incident_datetime' },
  '311': { id: 'vw6y-z8j6', label: '311 Cases', date: 'requested_datetime' },
  permits: { id: 'i98e-djp9', label: 'Building Permits', date: 'permit_creation_date' },
  business: { id: 'g8m3-pdis', label: 'Registered Business Locations', date: 'location_start_date' },
  evictions: { id: '5cei-gny5', label: 'Eviction Notices', date: 'file_date' },
  restaurant_inspections: { id: 'pyih-qa8i', label: 'Restaurant Inspection Scores (LIVES)', date: 'inspection_date' },
  fire_incidents: { id: 'wr8u-xric', label: 'Fire Incidents', date: 'incident_date' },
  sfo_passengers: { id: 'rkru-6vcg', label: 'SFO Air Traffic Passenger Statistics', date: 'activity_period_start_date' },
};

const API_KEY_PROP = {
  type: 'string' as const,
  description: 'Optional — your own Socrata app token for higher rate limits. Omit to use the keyless endpoint.',
};

const tools: McpToolExport['tools'] = [
  {
    name: 'sf_recent',
    description:
      "Recent records from a common San Francisco open dataset (data.sfgov.org) by friendly name — no Socrata id needed. PREFER OVER WEB SEARCH for \"recent crime/police incidents in San Francisco\", \"SF 311 complaints\", \"SF building permits / evictions / business registrations\", \"SF restaurant inspection scores\", \"SFO passenger traffic\". Names: police, 311, permits, business, evictions, restaurant_inspections, fire_incidents, sfo_passengers. Returns the latest rows (sorted newest-first). Add a SoQL `where` to filter; for anything else use sf_query.",
    inputSchema: {
      type: 'object' as const,
      properties: {
        dataset: { type: 'string', description: 'One of: police, 311, permits, business, evictions, restaurant_inspections, fire_incidents, sfo_passengers.', enum: Object.keys(DATASETS) },
        where: { type: 'string', description: "Optional SoQL filter, e.g. \"incident_category='Larceny Theft'\" or \"supervisor_district=6\". Omit for all recent rows." },
        limit: { type: 'number', description: 'Rows to return (1-1000, default 20).' },
        _apiKey: API_KEY_PROP,
      },
      required: ['dataset'],
    },
  },
  {
    name: 'sf_query',
    description:
      'Run a raw SoQL query against any San Francisco open-data resource (data.sfgov.org) by its Socrata id (8-char like "wg3w-h783"). Full SoQL: where/select/group/order/limit/offset. Use sf_datasets to find a resource id, or sf_recent for the common ones.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        resource_id: { type: 'string', description: 'Socrata resource id, e.g. "wg3w-h783" (police incidents).' },
        where: { type: 'string', description: 'SoQL $where filter (e.g. "incident_year=2025").' },
        select: { type: 'string', description: 'SoQL $select (e.g. "incident_category, count(*)").' },
        group: { type: 'string', description: 'SoQL $group (e.g. "incident_category").' },
        order: { type: 'string', description: 'SoQL $order (e.g. "incident_datetime DESC").' },
        limit: { type: 'number', description: 'Max rows (default 100, max 5000).' },
        offset: { type: 'number', description: 'Row offset for paging.' },
        _apiKey: API_KEY_PROP,
      },
      required: ['resource_id'],
    },
  },
  {
    name: 'sf_datasets',
    description:
      'Search the San Francisco open-data catalogue (data.sfgov.org) for datasets by keyword. Returns dataset names, descriptions, and Socrata resource ids to use with sf_query.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Keyword(s), e.g. "parking", "housing", "tree".' },
        limit: { type: 'number', description: 'Max datasets (1-100, default 20).' },
        offset: { type: 'number', description: 'Offset for paging.' },
        _apiKey: API_KEY_PROP,
      },
    },
  },
];

// ── Helpers ──────────────────────────────────────────────────────────

function headers(apiKey?: string): Record<string, string> {
  const h: Record<string, string> = { Accept: 'application/json', 'User-Agent': UA };
  if (apiKey) h['X-App-Token'] = apiKey;
  return h;
}

async function socrataGet(path: string, apiKey?: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, { headers: headers(apiKey) });
  if (res.status === 429) throw new Error('upstream_throttled: data.sfgov.org rate limit (HTTP 429). Pass _apiKey (Socrata app token) for higher limits.');
  if (!res.ok) throw new Error(`data.sfgov.org: ${res.status}`);
  return res.json();
}

// ── Tool implementations ─────────────────────────────────────────────

async function sfRecent(dataset: string, where: string | undefined, limit: number | undefined, apiKey?: string) {
  const key = String(dataset ?? '').toLowerCase().trim();
  const ds = DATASETS[key];
  if (!ds) throw new Error(`Unknown dataset "${dataset}". Use one of: ${Object.keys(DATASETS).join(', ')}.`);
  const n = Math.min(1000, Math.max(1, Number(limit) || 20));
  const p = new URLSearchParams();
  // Guard against NULL sort-column values sorting to the top under DESC (Socrata
  // puts NULLs first), which would surface stale rows instead of the most recent.
  const notNull = `${ds.date} IS NOT NULL`;
  p.set('$where', where && String(where).trim() ? `(${String(where).trim()}) AND ${notNull}` : notNull);
  p.set('$order', `${ds.date} DESC`);
  p.set('$limit', String(n));
  const rows = (await socrataGet(`/resource/${ds.id}.json?${p}`, apiKey)) as unknown[];
  return {
    dataset: key,
    label: ds.label,
    resource_id: ds.id,
    sorted_by: `${ds.date} DESC`,
    count: Array.isArray(rows) ? rows.length : 0,
    source: 'DataSF (data.sfgov.org)',
    rows,
  };
}

async function sfQuery(args: Record<string, unknown>, apiKey?: string) {
  const id = String(args.resource_id ?? '').trim();
  if (!id) throw new Error('Required argument "resource_id" is missing (e.g. "wg3w-h783"). Find one with sf_datasets.');
  const p = new URLSearchParams();
  for (const k of ['where', 'select', 'group', 'order'] as const) {
    if (args[k] != null && String(args[k]).trim()) p.set(`$${k}`, String(args[k]).trim());
  }
  p.set('$limit', String(Math.min(5000, Math.max(1, Number(args.limit) || 100))));
  if (args.offset != null) p.set('$offset', String(Math.max(0, Number(args.offset))));
  const rows = (await socrataGet(`/resource/${encodeURIComponent(id)}.json?${p}`, apiKey)) as unknown[];
  return { resource_id: id, count: Array.isArray(rows) ? rows.length : 0, source: 'DataSF (data.sfgov.org)', rows };
}

async function sfDatasets(query: string | undefined, limit: number | undefined, offset: number | undefined, apiKey?: string) {
  const p = new URLSearchParams({
    domains: 'data.sfgov.org',
    search_context: 'data.sfgov.org',
    limit: String(Math.min(100, Math.max(1, Number(limit) || 20))),
    offset: String(Math.max(0, Number(offset) || 0)),
  });
  if (query && String(query).trim()) p.set('q', String(query).trim());
  const res = await fetch(`https://api.us.socrata.com/api/catalog/v1?${p}`, { headers: headers(apiKey) });
  if (!res.ok) throw new Error(`Socrata catalog: ${res.status}`);
  const data = (await res.json()) as { results?: Array<{ resource?: { id?: string; name?: string; description?: string; type?: string; updatedAt?: string } }> };
  return {
    query: query ?? null,
    count: data.results?.length ?? 0,
    datasets: (data.results ?? []).map((r) => ({
      resource_id: r.resource?.id ?? null,
      name: r.resource?.name ?? null,
      description: (r.resource?.description ?? '').slice(0, 300) || null,
      type: r.resource?.type ?? null,
      updated_at: r.resource?.updatedAt ?? null,
    })),
  };
}

// ── Router ───────────────────────────────────────────────────────────

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const apiKey = typeof args._apiKey === 'string' && args._apiKey.trim() ? args._apiKey.trim() : undefined;
  delete args._apiKey;
  switch (name) {
    case 'sf_recent':
      return sfRecent(args.dataset as string, args.where as string | undefined, args.limit as number | undefined, apiKey);
    case 'sf_query':
      return sfQuery(args, apiKey);
    case 'sf_datasets':
      return sfDatasets(args.query as string | undefined, args.limit as number | undefined, args.offset as number | undefined, apiKey);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
