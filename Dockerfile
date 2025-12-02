FROM node:24.4.1-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

ARG PNPM_STORE_PATH=/pnpm/store
ENV PNPM_STORE_PATH=$PNPM_STORE_PATH

RUN npm install -g pnpm@10.23.0

WORKDIR /usr/src/app

COPY pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=${PNPM_STORE_PATH} \
    pnpm fetch --frozen-lockfile

COPY package.json pnpm-workspace.yaml ./
COPY server/package.json server/

RUN --mount=type=cache,id=pnpm-store,target=${PNPM_STORE_PATH} \
    pnpm install --frozen-lockfile --offline

COPY server/ server/

RUN pnpm install --frozen-lockfile

FROM base AS build

RUN pnpm --filter server build

FROM base AS pruned

RUN pnpm --filter server --prod deploy --legacy pruned

FROM gcr.io/distroless/nodejs24-debian12

WORKDIR /app

COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

COPY --from=build /usr/src/app/server/dist ./dist
COPY --from=pruned /usr/src/app/pruned/node_modules ./node_modules

ENV PORT=8080

EXPOSE 8080

CMD ["/app/dist/index.js"]
