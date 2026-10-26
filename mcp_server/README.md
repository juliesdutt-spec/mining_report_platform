# DataForge MCP server

Lets AI assistants (Alexa+, Claude, or any MCP client) use DataForge as a set of
tools. It is a self-hosted MCP server over **Streamable HTTP** (protocol
2025-11-25 or later), and it holds no data itself: every tool calls the DataForge
REST API as one signed-in account.

| Tool | What it returns |
|---|---|
| `search_reports(query, limit)` | Stored reports whose filename, mine, company, location or mineral matches |
| `get_report(report_id)` | Extracted fields, summary, and the page + quote behind each cited value |
| `list_conflicts(organisation)` | Figures that disagree across reports, missing fields, duplicates |
| `ask(question, organisation)` | An answer from the indexed reports, with document + page citations |

## Run

```bash
pip install -r mcp_server/requirements.txt      # separate from the backend: needs a newer Starlette
python -m mcp_server.dataforge_mcp               # serves http://127.0.0.1:8765/mcp
```

| Variable | Default |
|---|---|
| `DATAFORGE_API_URL` | `https://dataforge-backend-x80o.onrender.com` |
| `DATAFORGE_USERNAME` / `DATAFORGE_PASSWORD` | the public read-only demo account |
| `MCP_HOST` / `MCP_PORT` | `127.0.0.1` / `8765` |

The default account can only read. To let an assistant see your own reports, set
your own username and password in the environment; never commit them.

## Try it

- **MCP Inspector:** `npx @modelcontextprotocol/inspector`, choose *Streamable HTTP*,
  URL `http://127.0.0.1:8765/mcp`.
- **Any MCP client:** point it at the same URL. For Alexa+, host the server on a
  public HTTPS URL and register that as the MCP endpoint.

Example: "What was Gevra Opencast Mine's production in FY 2024-25, and was it
revised?" uses `ask` and `list_conflicts`; the answer cites EN-02 page 1
(52.5 million tonnes) and EN-03 page 1 (49.8 million tonnes).

Tests: `python -m pytest tests/test_mcp_server.py` (skipped unless the SDK is installed).
