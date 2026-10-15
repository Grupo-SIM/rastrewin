# SorteioPilot (mock)

Monorepo: **Next.js** (apps/web) + **NestJS** (apps/api) + **Prisma/PostgreSQL**. Dados 100% mockados.

## Rodar
```bash
npm install
npm run db:up      # Postgres via Docker (porta 5432)
npm run db:push    # cria as tabelas
npm run db:seed    # 48 sorteios mockados (8 terminam em poucos minutos)
npm run dev        # API :3001 + Web :3000
```

- `/` landing + cadastro + checkout (placeholder, botão "Simular pagamento aprovado")
- `/dashboard` sorteios do usuário, contador, participantes infinitos, console do robô e logos
- `/admin` define o ganhador de cada sorteio (chave: `ADMIN_KEY` em apps/api/.env, padrão `admin123`)

O ganhador só aparece para o usuário quando o tempo acaba **e** o admin definiu um (senão "Apurando resultado...").
Use "Encerrar em 10s" no admin para testar rápido.
