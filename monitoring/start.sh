#!/usr/bin/env bash
# Starts the probe, Prometheus and Grafana for RuMampu in the background.
# Safe to run twice: anything already running is left alone.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
DATA="$DIR/.data"
RUN="$DATA/run"
LOGS="$DATA/logs"
mkdir -p "$RUN" "$LOGS" "$DATA/prometheus" "$DATA/grafana" "$DATA/plugins"

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing $1." >&2; exit 1; }; }
need python3
need sqlite3

# Grafana and Prometheus: the copies install-tools.sh put in .data/bin
ls "$DATA"/bin/grafana-*/bin/grafana "$DATA"/bin/prometheus-*/prometheus >/dev/null 2>&1 || "$DIR/install-tools.sh"
GRAFANA_HOME="$(ls -d "$DATA"/bin/grafana-* | sort -V | tail -1)"
GRAFANA="$GRAFANA_HOME/bin/grafana"
PROMETHEUS="$(ls -d "$DATA"/bin/prometheus-* | sort -V | tail -1)/prometheus"

running() { [ -f "$RUN/$1.pid" ] && kill -0 "$(cat "$RUN/$1.pid")" 2>/dev/null; }

# Grafana admin password: made once, kept only in .data (never committed)
if [ ! -f "$DATA/admin-password.txt" ]; then
  python3 -c "import secrets; print(secrets.token_urlsafe(18))" > "$DATA/admin-password.txt"
  chmod 600 "$DATA/admin-password.txt"
fi

# Snapshot of the local database for the app data dashboard
[ -f "$DATA/rumampu-local.sqlite3" ] || "$DIR/refresh-db.sh"

# SQLite plugin for Grafana (downloaded once from grafana.com)
if [ ! -d "$DATA/plugins/frser-sqlite-datasource" ]; then
  echo "Installing the Grafana SQLite plugin"
  "$GRAFANA" cli --homepath "$GRAFANA_HOME" --pluginsDir "$DATA/plugins" plugins install frser-sqlite-datasource >> "$LOGS/grafana.log" 2>&1
fi

if running probe; then echo "Probe already running"; else
  nohup python3 "$DIR/probe/probe_exporter.py" --config "$DIR/probe/targets.json" >> "$LOGS/probe.log" 2>&1 &
  echo $! > "$RUN/probe.pid"; echo "Probe started on http://127.0.0.1:9115/metrics"
fi

if running prometheus; then echo "Prometheus already running"; else
  nohup "$PROMETHEUS" --config.file="$DIR/prometheus/prometheus.yml" --storage.tsdb.path="$DATA/prometheus" \
    --storage.tsdb.retention.time=15d --web.listen-address=127.0.0.1:9090 >> "$LOGS/prometheus.log" 2>&1 &
  echo $! > "$RUN/prometheus.pid"; echo "Prometheus started on http://127.0.0.1:9090"
fi

if running grafana; then echo "Grafana already running"; else
  RUMAMPU_MONITORING_DIR="$DIR" \
  GF_PATHS_DATA="$DATA/grafana" GF_PATHS_LOGS="$LOGS" GF_PATHS_PLUGINS="$DATA/plugins" \
  GF_PATHS_PROVISIONING="$DIR/grafana/provisioning" \
  GF_SECURITY_ADMIN_PASSWORD="$(cat "$DATA/admin-password.txt")" \
  nohup "$GRAFANA" server --homepath "$GRAFANA_HOME" --config "$DIR/grafana/grafana.ini" >> "$LOGS/grafana.log" 2>&1 &
  echo $! > "$RUN/grafana.pid"; echo "Grafana started on http://127.0.0.1:3000"
fi

echo
echo "Sign in to Grafana as admin. The password is in $DATA/admin-password.txt"
echo "Check everything with: $DIR/status.sh"
