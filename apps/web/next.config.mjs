// Front chama /api/* (mesma origem); o Next repassa para a API local.
// Assim funciona por localhost e por túnel (ex.: dev.zaker.qzz.io) sem expor a porta da API.
const API_TARGET = process.env.API_INTERNAL_URL ?? 'http://localhost:3011';

export default {
  output: 'standalone',
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_TARGET}/:path*` }];
  },
};
