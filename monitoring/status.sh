#!/usr/bin/env bash
# Shows whether each part of the monitoring setup is up.
set -uo pipefail
check() {
  local name="$1" url="$2"
  if code=$(curl -s -o /dev/null -m 5 -w "%{http_code}" "$url") && [ "$code" = "200" ]; then
    printf "  %-12s up     %s\n" "$name" "$url"
  else
    printf "  %-12s DOWN   %s (HTTP %s)\n" "$name" "$url" "${code:-none}"
  fi
}
echo "Monitoring"
check "Probe" "http://127.0.0.1:9115/metrics"
check "Prometheus" "http://127.0.0.1:9090/-/ready"
check "Grafana" "http://127.0.0.1:3000/api/health"
echo "App being watched"
check "API" "http://127.0.0.1:8000/api/v1/health/"
check "Web app" "http://127.0.0.1:8081/"
