#!/usr/bin/env bash
set -euo pipefail

mkdir -p /workspace /screenshots /tmp/.X11-unix
exec /usr/bin/supervisord -c /runtime/supervisord.conf
