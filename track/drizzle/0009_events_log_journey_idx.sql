-- Jornada do visitante: todos os eventos de uma pessoa, em ordem. Só um índice: nenhum dado muda.
-- IF NOT EXISTS: pode ser reaplicada sem erro (ver o incidente da 0007).
CREATE INDEX IF NOT EXISTS "events_log_trck_user_id_created_at_idx" ON "events_log" USING btree ("trck_user_id","created_at");
