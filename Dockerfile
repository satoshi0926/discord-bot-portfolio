# ベースイメージの定義（共通設定）
FROM node:20 AS base
WORKDIR /app
ENV NODE_ENV="production"

# ビルド用ステージ：依存パッケージをインストール
FROM base AS build

# ネイティブモジュールがある場合のためにビルドツールをインストール
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# package.json と lock ファイルをコピーして npm ci 実行
COPY package*.json ./
RUN npm ci

# ソースコードをすべてコピー
COPY . .

# 実行用ステージ：軽量な本番環境イメージを構築
FROM base

# buildステージからアプリケーションをコピー
COPY --from=build /app /app

# Bot は HTTP ポートを使わないが、必要な場合は開放
EXPOSE 3000

# アプリケーション起動
CMD ["npm", "run", "start"]