"""
DataForge as tools for AI assistants: Alexa+, Claude, or any MCP client.

A self-hosted MCP server over Streamable HTTP. It keeps no data of its own:
every tool calls the DataForge REST API as one signed-in account, so an
assistant sees exactly what that account may see. The default account is the
public read-only demo, which cannot upload, delete or resolve anything.

    DATAFORGE_API_URL     default https://dataforge-backend-x80o.onrender.com
    DATAFORGE_USERNAME    default demo
    DATAFORGE_PASSWORD    default dataforge-demo
    MCP_HOST / MCP_PORT   default 127.0.0.1 / 8765

Run it with `python -m mcp_server.dataforge_mcp`; the endpoint is
http://127.0.0.1:8765/mcp.

Kept out of requirements.txt on purpose: the MCP SDK needs a newer Starlette
than the backend's FastAPI accepts, so it has its own requirements file and
runs as a separate process.
"""
from __future__ import annotations

import os
from typing import Any

import httpx
from mcp.server.mcpserver import MCPServer

API_URL = os.getenv("DATAFORGE_API_URL", "https://dataforge-backend-x80o.onrender.com").rstrip("/")
USERNAME = os.getenv("DATAFORGE_USERNAME", "demo")
PASSWORD = os.getenv("DATAFORGE_PASSWORD", "dataforge-demo")

# The free backend sleeps when idle and takes about a minute to wake, and a
# question is a model call; both need longer than httpx's 5 s default.
TIMEOUT = httpx.Timeout(120.0, connect=90.0)


class DataForgeClient:
    """The REST API, signed in once and again whenever the token lapses."""

    def __init__(self, base_url: str = API_URL, username: str = USERNAME, password: str = PASSWORD,
                 transport: httpx.AsyncBaseTransport | None = None):
        self._http = httpx.AsyncClient(base_url=base_url, timeout=TIMEOUT, transport=transport)
        self._username, self._password = username, password
        self._token: str | None = None

    async def _login(self) -> None:
        res = await self._http.post("/auth/login", json={"username": self._username, "password": self._password})
        res.raise_for_status()
        self._token = res.json()["access_token"]

    async def request(self, method: str, path: str, **kwargs: Any) -> Any:
        if self._token is None:
            await self._login()
        for attempt in (1, 2):
            res = await self._http.request(method, path, headers={"Authorization": f"Bearer {self._token}"}, **kwargs)
            if res.status_code == 401 and attempt == 1:
                await self._login()
                continue
            if res.is_error:
                detail = res.json().get("detail") if "json" in res.headers.get("content-type", "") else res.text
                raise RuntimeError(f"DataForge answered {res.status_code}: {detail}")
            return res.json()


def _summary(report: dict) -> dict:
    return {k: report.get(k) for k in ("id", "filename", "status", "mine_name", "company_name", "location",
                                       "mineral_type", "quantity_extracted", "report_date")}


def build_server(client: DataForgeClient | None = None) -> MCPServer:
    api = client or DataForgeClient()
    server = MCPServer(
        name="DataForge",
        instructions=(
            "Mining and geological reports from CMPDI and Coal India subsidiaries, with extracted fields, "
            "page-level evidence and cross-report conflicts. Quote page numbers when you give a figure; "
            "a value without evidence has not been verified against its source."
        ),
    )

    @server.tool()
    async def search_reports(query: str = "", limit: int = 20) -> list[dict]:
        """Find stored reports whose filename, mine, company, location or mineral contains `query` (empty lists all)."""
        body = await api.request("GET", "/reports", params={"limit": 100})
        q = query.casefold().strip()
        found = [
            _summary(r) for r in body.get("reports", [])
            if not q or any(q in str(r.get(k) or "").casefold()
                            for k in ("filename", "mine_name", "company_name", "location", "mineral_type"))
        ]
        return found[: max(1, min(limit, 100))]

    @server.tool()
    async def get_report(report_id: int) -> dict:
        """One report's extracted fields, summary, and the page and quote behind each cited value."""
        report = await api.request("GET", f"/reports/{report_id}")
        return {
            **_summary(report),
            "reserve_estimate": (report.get("extracted_data") or {}).get("reserve_estimate"),
            "summary": report.get("summary"),
            "page_count": report.get("page_count"),
            "evidence": [
                {"field": e.get("field"), "value": e.get("extractedValue"), "page": e.get("pageNumber"),
                 "quote": e.get("originalContext")}
                for e in report.get("evidence") or []
            ],
        }

    @server.tool()
    async def list_conflicts(organisation: str | None = None) -> list[dict]:
        """Figures that disagree between reports about the same mine, plus missing fields and duplicates."""
        params = {"organisation": organisation} if organisation else None
        body = await api.request("GET", "/validation", params=params)
        return [
            {k: f.get(k) for k in ("type", "severity", "title", "mineName", "organisation", "fieldName",
                                   "sourceA", "sourceB", "detail")}
            for f in body.get("findings", [])
        ]

    @server.tool()
    async def ask(question: str, organisation: str | None = None) -> dict:
        """Answer a question from the indexed reports, with the document and page each passage came from."""
        params = {"question": question, **({"organisation": organisation} if organisation else {})}
        body = await api.request("POST", "/query", params=params)
        return {
            "answer": body.get("answer"),
            "citations": [{"filename": p.get("filename"), "page": p.get("page")}
                          for p in body.get("retrieved_passages") or []],
            "answered_by": body.get("answer_source"),
            "note": body.get("answer_note") or body.get("retrieval_note"),
        }

    return server


if __name__ == "__main__":
    build_server().run(
        transport="streamable-http",
        host=os.getenv("MCP_HOST", "127.0.0.1"),
        port=int(os.getenv("MCP_PORT", "8765")),
    )
