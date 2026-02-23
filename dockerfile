# ----------------------------------------------------------------
# Stage 1: Base Image & Dependencies (deps)
# Cài đặt dependencies để tận dụng Docker layer caching
# ----------------------------------------------------------------
FROM node:22-alpine AS base
FROM base AS deps

# Cần libc6-compat cho một số package Node.js trên Alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Sao chép các file quản lý dependency
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./

# Cài đặt dependencies dựa trên lockfile được tìm thấy
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

# ----------------------------------------------------------------
# Stage 2: Builder
# Thực hiện quá trình build (tsc)
# ----------------------------------------------------------------
FROM base AS builder
WORKDIR /app

# Sao chép node_modules từ stage deps
COPY --from=deps /app/node_modules ./node_modules
# Sao chép source code
COPY . .

# Thực hiện build NestJS (chuyển TypeScript sang JavaScript)
# Lệnh 'build' thường được định nghĩa trong package.json
# Ví dụ: "build": "nest build"
RUN \
  if [ -f yarn.lock ]; then yarn run build; \
  elif [ -f package-lock.json ]; then npm run build; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
  else echo "Build command not found." && exit 1; \
  fi

# ----------------------------------------------------------------
# Stage 3: Runner (Final Image)
# Image cuối cùng, nhỏ nhất, chỉ chứa code đã build và dependencies cần thiết
# ----------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Tạo user và group không phải root để tăng cường bảo mật
# UID/GID tùy ý, miễn là không phải 0 (root)
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Sao chép node_modules cần thiết cho môi trường production
# (Chỉ bao gồm production dependencies)
COPY --from=deps /app/node_modules ./node_modules

# Sao chép thư mục dist đã build từ stage builder (đầu ra của 'nest build')
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
# Sao chép package.json (cần cho lệnh 'node dist/main')
COPY package.json .

# Chuyển sang user không phải root
USER nestjs

# Thiết lập cổng và export
EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# Chạy ứng dụng đã được build
# Giả định file khởi chạy là 'main.js' trong thư mục 'dist'
CMD ["node", "dist/main.js"]