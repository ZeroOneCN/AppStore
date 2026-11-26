# 多阶段构建：deps 安装依赖 → builder 生成 standalone → runner 最小运行时
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    BUILD_STANDALONE=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# standalone 已包含运行所需的 node_modules 与 server.js
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# SQLite 与文件存储目录，建议挂载为数据卷
RUN mkdir -p /app/data /app/storage && chown -R nextjs:nodejs /app/data /app/storage

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
