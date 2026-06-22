FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

ARG NODE_VERSION=20.19.0
ARG PNPM_VERSION=9.15.9
ARG USERNAME=vscode

ENV DEBIAN_FRONTEND=noninteractive
ENV PATH=/usr/local/node/bin:${PATH}

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    curl \
    git \
    gnupg \
    jq \
    libpq-dev \
    openssh-client \
    openssl \
    pkg-config \
    postgresql-client \
    protobuf-compiler \
    python3 \
    python3-pip \
    python3-venv \
    redis-tools \
    shellcheck \
    unzip \
    wget \
    zstd \
  && rm -rf /var/lib/apt/lists/*

RUN arch="$(dpkg --print-architecture)" \
  && case "${arch}" in \
    amd64) node_arch="x64" ;; \
    arm64) node_arch="arm64" ;; \
    *) echo "Unsupported architecture: ${arch}" >&2; exit 1 ;; \
  esac \
  && curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${node_arch}.tar.xz" -o /tmp/node.tar.xz \
  && mkdir -p /usr/local/node \
  && tar -xJf /tmp/node.tar.xz -C /usr/local/node --strip-components=1 \
  && rm /tmp/node.tar.xz \
  && npm install -g "pnpm@${PNPM_VERSION}"

RUN mkdir -p /workspace-cache/pnpm \
  && chown -R "${USERNAME}:${USERNAME}" /workspace-cache

USER ${USERNAME}

WORKDIR /workspaces/Chifoumi
