"""Jeff connector for Jeff 2.

Loads Jeff's open "triage" adapter once and answers one question over HTTP:
which of our problem categories does this description belong to, and how urgent is it?

Run it inside your downloaded Jeff folder (Jeff is not on PyPI yet):
    uv run --project /path/to/jeff python jeff-bridge/bridge.py
The first run downloads the model (about 1.7 GB); after that it works offline.

POST /classify  {"text": "...", "labels": {"traffic": "Traffic accidents ...", ...}}
  ->            {"category": "traffic", "confidence": 0.93, "probabilities": {...}, "urgency": 0.0-1.0}
GET  /health    -> {"ok": true}
"""

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Lock

from jeff import Jeff

PORT = int(os.environ.get("JEFF_BRIDGE_PORT", "8790"))
CONTEXT = {
    "company": "A free legal pre-check service for individuals in Japan, Taiwan and mainland China, "
               "supervised by lawyers. People describe a personal legal problem in Japanese or Chinese.",
    "channel": "web form",
}

print("Loading Jeff (first run downloads the model)...", flush=True)
jeff = Jeff.local(["triage"], backend=os.environ.get("JEFF_BACKEND", "auto"))
lock = Lock()  # Jeff answers one request at a time
print(f"Jeff connector ready on http://localhost:{PORT}", flush=True)


def classify(text: str, labels: dict[str, str]) -> dict:
    # "other" is built into the adapter, so it is not passed as a caller label.
    caller = {k: v for k, v in labels.items() if k != "other"}
    with lock:
        route = jeff.function("triage.route", context=CONTEXT, labels=caller)(text)
        urgency = jeff.function("triage.urgency", context=CONTEXT)(text)
    levels = 4  # urgency score runs 0 (no action) .. 4 (handle immediately)
    return {
        "category": route.value,
        "confidence": route.confidence,
        "probabilities": route.probabilities,
        "urgency": (urgency.score or 0) / levels,
    }


class Handler(BaseHTTPRequestHandler):
    def _send(self, status: int, body: dict) -> None:
        data = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:
        self._send(200, {"ok": True}) if self.path == "/health" else self._send(404, {"error": "not found"})

    def do_POST(self) -> None:
        if self.path != "/classify":
            return self._send(404, {"error": "not found"})
        try:
            length = min(int(self.headers.get("Content-Length", 0)), 20000)
            req = json.loads(self.rfile.read(length) or b"{}")
            self._send(200, classify(str(req.get("text", ""))[:2000], dict(req.get("labels", {}))))
        except Exception as error:  # keep the main site working whatever happens here
            self._send(500, {"error": str(error)})

    def log_message(self, *args) -> None:  # no request logging: descriptions are private
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
