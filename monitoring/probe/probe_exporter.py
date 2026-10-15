"""RuMampu uptime probe.

Checks each URL in targets.json on its own schedule and serves the results as
Prometheus metrics on /metrics. Uses only the Python standard library, so it
runs without installing anything. Read only: it sends plain GET requests with
no client id and no token, so it never creates guest profiles or changes data.
"""
import argparse
import json
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

STATE = {}
LOCK = threading.Lock()


def probe(target, timeout):
    started = time.monotonic()
    status = 0
    try:
        req = urllib.request.Request(target["url"], headers={"User-Agent": "rumampu-probe/1"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            resp.read(65536)
            status = resp.status
    except urllib.error.HTTPError as err:
        status = err.code
    except Exception:  # connection refused, timeout, DNS
        status = 0
    duration = time.monotonic() - started
    ok = 1 if status == target.get("expect_status", 200) else 0
    with LOCK:
        s = STATE.setdefault(target["name"], {"checks": 0, "failures": 0})
        s.update(success=ok, duration=duration, status=status, last=time.time())
        s["checks"] += 1
        s["failures"] += 0 if ok else 1


def loop(target, timeout):
    while True:
        probe(target, timeout)
        time.sleep(target.get("every_seconds", 15))


METRICS = [
    ("probe_success", "gauge", "1 when the last check returned the expected status, 0 otherwise", "success"),
    ("probe_duration_seconds", "gauge", "How long the last check took, in seconds", "duration"),
    ("probe_http_status_code", "gauge", "HTTP status of the last check (0 when the server could not be reached)", "status"),
    ("probe_last_run_timestamp_seconds", "gauge", "Unix time of the last check", "last"),
    ("probe_checks_total", "counter", "Checks run since the probe started", "checks"),
    ("probe_failures_total", "counter", "Failed checks since the probe started", "failures"),
]


def render(targets):
    lines = []
    with LOCK:
        for metric, kind, help_text, key in METRICS:
            lines.append(f"# HELP {metric} {help_text}")
            lines.append(f"# TYPE {metric} {kind}")
            for t in targets:
                s = STATE.get(t["name"])
                if not s or key not in s:
                    continue
                labels = f'name="{t["name"]}",label="{t["label"]}",url="{t["url"]}"'
                lines.append(f"{metric}{{{labels}}} {s[key]}")
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    with open(parser.parse_args().config) as fh:
        cfg = json.load(fh)
    targets, timeout = cfg["targets"], cfg.get("timeout_seconds", 10)
    for t in targets:
        threading.Thread(target=loop, args=(t, timeout), daemon=True).start()

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path.split("?")[0] not in ("/metrics", "/"):
                self.send_error(404)
                return
            body = render(targets).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; version=0.0.4")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):
            pass

    host, port = cfg.get("listen", "127.0.0.1:9115").rsplit(":", 1)
    ThreadingHTTPServer((host, int(port)), Handler).serve_forever()


if __name__ == "__main__":
    main()
