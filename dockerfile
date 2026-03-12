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
RUN \
  if [ -f yarn.lock ]; then yarn run build; \
  elif [ -f package-lock.json ]; then npm run build; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
  else echo "Build command not found." && exit 1; \
  fi

# ----------------------------------------------------------------
# Stage 3: Runner (Final Image)
# Sử dụng Debian-slim + Python3 + pywinrm thay vì PowerShell.
# pywinrm kết nối trực tiếp tới WinRM (NTLM) trên Exchange Server,
# không cần pwsh/PSWSMan/OMI — loại bỏ hoàn toàn lỗi MI_RESULT_FAILED.
# ----------------------------------------------------------------
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Cài đặt Python3 + pip + pywinrm cho xác thực WinRM/NTLM tới Exchange
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    python3 \
    python3-pip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# pypsrp 0.9.0 stable: ket noi WinRM toi Exchange Server
RUN pip3 install --no-cache-dir --break-system-packages "pypsrp==0.9.0"

# Tạo user bảo mật
RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 --gid nodejs --no-create-home nestjs

# CHỈ copy những thứ cần thiết
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/scripts ./scripts

# Chuyển sang user nestjs
USER nestjs

EXPOSE 3001
ENV PORT=3001

# Chạy trực tiếp file đã build bằng node
CMD ["node", "dist/src/main.js"]