/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },

  // デモ用のSQLiteファイルを、サーバー側の実行バンドルに同梱する
  outputFileTracingIncludes: {
    "/**": ["./prisma/dev.db"],
  },

  // PDF生成に使うが、実行環境によっては存在しない。
  // バンドルせず、読み込みに失敗したら印刷用ページへ退避する。
  serverExternalPackages: ["playwright"],
};

export default nextConfig;
