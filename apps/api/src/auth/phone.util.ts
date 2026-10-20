/** Normaliza um telefone para comparação: só dígitos, com DDI 55 se vier sem (padrão BR). */
export function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  return `55${digits}`;
}

/** Gera um código numérico de 6 dígitos para o OTP reverso. */
export function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
