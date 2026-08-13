FROM node:22-alpine AS build
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/prisma ./prisma
COPY backend/src ./src
COPY backend/tests ./tests
COPY backend/tsconfig.json ./tsconfig.json
COPY spectramind/src/core/framework-library ./framework-library
RUN npx prisma generate && npm run build

FROM node:22-alpine
ENV NODE_ENV=production \
    FRAMEWORK_LIBRARY_PATH=/app/framework-library \
    LOCAL_FILE_ROOT=/app/data/files
WORKDIR /app
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/framework-library ./framework-library
RUN mkdir -p /app/data/files && chown -R node:node /app/data
USER node
EXPOSE 4000
CMD ["node", "dist/src/server.js"]
