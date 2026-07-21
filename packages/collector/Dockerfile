# Multi-stage build for the Calibrate collector. Runs on any container host.
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/contract/package.json packages/contract/
COPY packages/collector/package.json packages/collector/
RUN npm install --workspaces --include-workspace-root
COPY . .
RUN npm run build -w @usecalibrate/contract && npm run build -w @usecalibrate/collector

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
ENV DATA_DIR=/data
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/contract/dist ./packages/contract/dist
COPY --from=build /app/packages/contract/package.json ./packages/contract/
COPY --from=build /app/packages/collector/dist ./packages/collector/dist
COPY --from=build /app/packages/collector/package.json ./packages/collector/
VOLUME ["/data"]
EXPOSE 8787
CMD ["node", "packages/collector/dist/cli.js"]
