"""Jeff connector for Jeff 2.

Loads Jeff's open "triage" adapter once and answers one question over HTTP:
which of our problem categories does this description belong to, and how urgent is it?

Run it inside your downloaded Jeff folder (Jeff is not on PyPI yet):
    uv run --project /path/to/jeff python jeff-bridge/bridge.py
The first run downloads the model (about 1.7 GB); after that it works offline.

POST /classify  {"text": "...", "labels": {"traffic": "Traffic accidents ...", ...}}
  ->            {"category": "traffic", "confidence": 0.93, "probabilities": {...}, "urgency": 0.0-1.0}
POST /judge     {"text": "...", "decisions": [{"id": "need", "labels": {"now": "...", "consult": "..."}}, ...]}
  ->            {"decisions": {"need": {"value": "now", "confidence": 0.8, "probabilities": {...}}}, "urgency": 0.0-1.0}
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


def choose(text: str, labels: dict[str, str]) -> dict:
    """One Jeff decision: which of the caller's options fits the text, with a share for each."""
    caller = {k: v for k, v in labels.items() if k != "other"}
    route = jeff.function("triage.route", context=CONTEXT, labels=caller)(text)
    probs = {k: float((route.probabilities or {}).get(k, 0.0)) for k in caller}
    total = sum(probs.values())
    if total > 0:  # leave out Jeff's built-in "other" bucket and rescale over our options
        probs = {k: p / total for k, p in probs.items()}
    value = route.value if route.value in caller else max(probs, key=probs.get)
    return {"value": value, "confidence": probs.get(value, route.confidence or 0.0), "probabilities": probs}


def judge(text: str, decisions: list[dict]) -> dict:
    """Several Jeff decisions about one case, plus Jeff's urgency score."""
    out = {}
    with lock:
        for d in decisions[:8]:
            out[str(d["id"])] = choose(text, dict(d["labels"]))
        urgency = jeff.function("triage.urgency", context=CONTEXT)(text)
    return {"decisions": out, "urgency": (urgency.score or 0) / 4}


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
        if self.path not in ("/classify", "/judge"):
            return self._send(404, {"error": "not found"})
        try:
            length = min(int(self.headers.get("Content-Length", 0)), 40000)
            req = json.loads(self.rfile.read(length) or b"{}")
            text = str(req.get("text", ""))[:3000]
            if self.path == "/judge":
                return self._send(200, judge(text, list(req.get("decisions", []))))
            self._send(200, classify(text, dict(req.get("labels", {}))))
        except Exception as error:  # keep the main site working whatever happens here
            self._send(500, {"error": str(error)})

    def log_message(self, *args) -> None:  # no request logging: descriptions are private
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
