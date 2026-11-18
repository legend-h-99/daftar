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

# Legacy demo image. prisma/migrations is frozen (AgDR-0004), so the schema
# comes from schema.prisma. db push refuses changes that would lose data.
# db push cannot create the partial unique indexes on User.email and
# User.googleId, so legacy-unique-indexes.sql adds them before the API starts.
CMD ["sh", "-c", "pnpm --filter api exec prisma db push --skip-generate && pnpm --filter api exec prisma db execute --schema prisma/schema.prisma --file prisma/legacy-unique-indexes.sql && pnpm --filter api start:prod"]
