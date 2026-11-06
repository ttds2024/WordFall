# WordFall multiplayer server. Build from the repository root, since the server shares
# src/core (dictionary, scoring) and data/ (word lists) with the game:
#   docker build -f server/Dockerfile -t wordfall-server .

FROM node:22-alpine AS build
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY src/core /app/src/core
COPY server/src ./src
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production PORT=2567 DATA_DIR=/app/data
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/server/dist ./dist
COPY data /app/data
USER node
EXPOSE 2567
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/index.mjs"]
