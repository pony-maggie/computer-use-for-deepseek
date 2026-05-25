FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN set -eux; \
    apt-get update -o Acquire::Retries=5; \
    apt-get install -y --no-install-recommends --fix-missing \
    -o Acquire::Retries=5 \
    -o Acquire::http::Timeout=60 \
    -o Acquire::https::Timeout=60 \
    ca-certificates \
    dbus-x11 \
    imagemagick \
    novnc \
    openbox \
    python3 \
    python3-pip \
    supervisor \
    websockify \
    x11vnc \
    xdotool \
    xvfb \
    procps \
    fontconfig \
    fonts-noto-cjk \
    && fc-cache -f \
    && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
    apt-get update -o Acquire::Retries=8; \
    apt-get install -y --no-install-recommends \
    -o Acquire::Retries=8 \
    -o Acquire::http::Timeout=120 \
    -o Acquire::https::Timeout=120 \
    chromium \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /runtime
COPY entrypoint.sh /runtime/entrypoint.sh
COPY supervisord.conf /runtime/supervisord.conf
COPY daemon.py /runtime/daemon.py
RUN chmod +x /runtime/entrypoint.sh

EXPOSE 6080 5900 7070
ENTRYPOINT ["/runtime/entrypoint.sh"]
