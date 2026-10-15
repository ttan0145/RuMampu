#!/usr/bin/env bash
# Stops whatever start.sh started. Collected data stays in .data.
set -uo pipefail
RUN="$(cd "$(dirname "$0")" && pwd)/.data/run"
for svc in grafana prometheus probe; do
  if [ -f "$RUN/$svc.pid" ] && kill -0 "$(cat "$RUN/$svc.pid")" 2>/dev/null; then
    kill "$(cat "$RUN/$svc.pid")" && echo "Stopped $svc"
  else
    echo "$svc was not running"
  fi
  rm -f "$RUN/$svc.pid"
done
