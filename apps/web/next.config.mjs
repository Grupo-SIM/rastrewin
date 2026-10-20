// Em dev, o front chama /api/* e o Next repassa para a API local (rewrite resolvido em
// build time). Em produção o front chama NEXT_PUBLIC_API_URL direto (ver lib/api.ts),
// já que o rewrite não pode variar por ambiente num build standalone.
const API_TARGET = process.env.API_INTERNAL_URL ?? 'http://localhost:3011';

export default {
  output: 'standalone',
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_TARGET}/:path*` }];
  },
};
