# Test runner image for obp-server-k3s Jobs: the Playwright suite with its safety layer, browsers included.
# The base is the official Playwright image for the version in package-lock.json, pinned by its multi-arch digest.
ARG PLAYWRIGHT_IMAGE=mcr.microsoft.com/playwright:v1.58.2-noble@sha256:6446946a1d9fd62d9ae501312a2d76a43ee688542b21622056a372959b65d63d
FROM ${PLAYWRIGHT_IMAGE}

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3-minimal \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund && npm cache clean --force
COPY . .
RUN ./node_modules/.bin/tsc --noEmit

# The Job runs this as uid 12345 on a read-only root file system with /tmp, /dev/shm and /results mounted.
ENV HOME=/tmp CI=1
USER 12345
ENTRYPOINT ["python3", "/app/run.py"]
CMD ["login"]
