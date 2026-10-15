#!/usr/bin/env bash
# Downloads the official prebuilt Grafana and Prometheus for macOS on Apple
# silicon into .data/bin, after checking each file against its published
# SHA-256 checksum. Nothing is installed system wide.
set -euo pipefail
GRAFANA_VERSION="${GRAFANA_VERSION:-13.2.3}"
PROMETHEUS_VERSION="${PROMETHEUS_VERSION:-3.15.0}"
ARCH="${ARCH:-darwin-arm64}"   # use darwin-amd64 on an Intel Mac

DIR="$(cd "$(dirname "$0")" && pwd)"
BIN="$DIR/.data/bin"
DL="$DIR/.data/dl"
mkdir -p "$BIN" "$DL"
cd "$DL"

verify() {  # file, expected checksum
  local actual
  actual="$(shasum -a 256 "$1" | cut -c1-64)"
  if [ "$actual" != "$2" ]; then
    echo "Checksum mismatch for $1. Expected $2, got $actual. Not installing." >&2
    rm -f "$1"
    exit 1
  fi
  echo "Checksum OK: $1"
}

if [ ! -x "$BIN/grafana-$GRAFANA_VERSION/bin/grafana" ]; then
  G="grafana-$GRAFANA_VERSION.$ARCH.tar.gz"
  echo "Downloading Grafana $GRAFANA_VERSION"
  curl -fsSLO "https://dl.grafana.com/oss/release/$G"
  verify "$G" "$(curl -fsSL "https://dl.grafana.com/oss/release/$G.sha256" | cut -c1-64)"
  tar -xzf "$G" -C "$BIN" && rm -f "$G"
fi

if [ ! -x "$BIN/prometheus-$PROMETHEUS_VERSION.$ARCH/prometheus" ]; then
  P="prometheus-$PROMETHEUS_VERSION.$ARCH.tar.gz"
  echo "Downloading Prometheus $PROMETHEUS_VERSION"
  curl -fsSLO "https://github.com/prometheus/prometheus/releases/download/v$PROMETHEUS_VERSION/$P"
  verify "$P" "$(curl -fsSL "https://github.com/prometheus/prometheus/releases/download/v$PROMETHEUS_VERSION/sha256sums.txt" | grep " $P\$" | cut -c1-64)"
  tar -xzf "$P" -C "$BIN" && rm -f "$P"
fi

# macOS marks downloaded programs as quarantined; these came from the official sites above
xattr -dr com.apple.quarantine "$BIN" 2>/dev/null || true
"$BIN/grafana-$GRAFANA_VERSION/bin/grafana" --version
"$BIN/prometheus-$PROMETHEUS_VERSION.$ARCH/prometheus" --version | head -1
