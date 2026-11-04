import { createAuthClient } from "better-auth/react";

/** Cliente do login (navegador). Usa a mesma origem do app — nenhuma env pública. */
export const authClient = createAuthClient();
