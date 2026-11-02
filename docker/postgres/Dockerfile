# syntax=docker/dockerfile:1
# Postgres 18 + pg_cron (retenção de logs) + pgcrypto (já vem no contrib).
FROM postgres:18

RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-18-cron \
 && rm -rf /var/lib/apt/lists/*

COPY initdb/ /docker-entrypoint-initdb.d/

# pg_cron precisa ser pré-carregado; cron.database_name = banco onde os jobs rodam.
# POSTGRES_DB deve ser igual a CRON_DATABASE (padrão: rastrewin).
ENV CRON_DATABASE=rastrewin
CMD ["sh", "-c", "exec docker-entrypoint.sh postgres -c shared_preload_libraries=pg_cron -c cron.database_name=${CRON_DATABASE} -c cron.timezone=UTC"]
