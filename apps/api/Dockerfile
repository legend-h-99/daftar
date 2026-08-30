FROM node:20-bookworm-slim

WORKDIR /app

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@10.33.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json

RUN pnpm install --frozen-lockfile --prod=false --filter api...

COPY apps/api apps/api

RUN pnpm --filter api prisma:generate
RUN pnpm --filter api build

ENV NODE_ENV=production

EXPOSE 3001

CMD ["sh", "-c", "pnpm --filter api exec prisma migrate deploy && pnpm --filter api start:prod"]
