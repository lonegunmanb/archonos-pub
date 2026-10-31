FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends git python3 \
    && rm -rf /var/lib/apt/lists/*

COPY . .

RUN npm ci \
    && ./scripts/install.sh \
    && rm -rf .archon packages/archon-app/public/artifacts packages/archon-app/public/uploads outputs \
    && node scripts/archon-init.mjs --quiet \
    && npm cache clean --force

CMD ["npm", "start"]
