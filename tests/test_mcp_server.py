"""
The MCP server exposes DataForge to AI assistants such as Alexa+.

It runs as its own process with its own requirements (the MCP SDK needs a
newer Starlette than the backend's FastAPI), so these tests skip unless the
SDK is installed: pip install -r mcp_server/requirements.txt
"""
import asyncio
import importlib.util
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
HAVE_MCP = importlib.util.find_spec("mcp") is not None and importlib.util.find_spec("httpx") is not None


@unittest.skipUnless(HAVE_MCP, "MCP SDK not installed")
class DataForgeMcpServer(unittest.TestCase):
    def setUp(self):
        import httpx
        from mcp_server.dataforge_mcp import DataForgeClient, build_server

        self.logins = 0
        self.expire_next = False

        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/auth/login":
                self.logins += 1
                return httpx.Response(200, json={"access_token": f"t{self.logins}"})
            if self.expire_next:
                self.expire_next = False
                return httpx.Response(401, json={"detail": "expired"})
            if request.url.path == "/query":
                self.assertEqual(request.url.params["question"], "Gevra production?")
                return httpx.Response(200, json={
                    "answer": "52.5 million tonnes, revised to 49.8.", "answer_source": "gemini",
                    "retrieved_passages": [{"filename": "EN-03.pdf", "page": 1, "report_id": 3, "similarity": 0.9}],
                })
            if request.url.path == "/reports":
                return httpx.Response(200, json={"total": 2, "reports": [
                    {"id": 2, "filename": "EN-02.pdf", "mine_name": "Gevra Opencast Mine", "status": "completed"},
                    {"id": 9, "filename": "HI-01.pdf", "mine_name": "Jayant", "status": "completed"},
                ]})
            return httpx.Response(404, json={"detail": "not found"})

        client = DataForgeClient("http://dataforge.test", "demo", "pw", transport=httpx.MockTransport(handler))
        self.server = build_server(client)

    def call(self, name, args):
        result = asyncio.run(self.server.call_tool(name, args))
        self.assertFalse(result.is_error, result.content)
        data = result.structured_content
        if data is None:
            return json.loads(result.content[0].text)
        # List results are wrapped as {"result": [...]}.
        return data.get("result", data) if set(data) == {"result"} else data

    def test_the_four_tools_are_offered(self):
        names = {t.name for t in asyncio.run(self.server.list_tools())}
        self.assertEqual(names, {"search_reports", "get_report", "list_conflicts", "ask"})

    def test_an_answer_carries_its_page_citations(self):
        out = self.call("ask", {"question": "Gevra production?"})
        self.assertIn("49.8", out["answer"])
        self.assertEqual(out["citations"], [{"filename": "EN-03.pdf", "page": 1}])

    def test_search_filters_by_mine(self):
        rows = self.call("search_reports", {"query": "gevra"})
        self.assertEqual([r["id"] for r in rows], [2])

    def test_an_expired_token_signs_in_again(self):
        self.call("search_reports", {})
        self.expire_next = True
        self.call("search_reports", {})
        self.assertEqual(self.logins, 2)


if __name__ == "__main__":
    unittest.main()
