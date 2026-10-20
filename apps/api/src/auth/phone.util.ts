/** Normaliza um telefone para comparação: só dígitos, com DDI 55 (padrão BR) e SEM o 9º dígito
 * do celular — o WhatsApp às vezes manda o JID sem esse 9 (formato antigo), então removê-lo dos
 * dois lados evita falso-negativo na comparação entre o cadastro e o remetente do OTP. */
export function normalizePhone(raw: string) {
  let digits = raw.replace(/\D/g, '');
  if (!digits.startsWith('55')) digits = `55${digits}`;
  // 55 + DDD(2) + 9 + número(8) = 13 dígitos → remove o 9 extra, fica 55 + DDD + número(8) = 12
  if (digits.length === 13 && digits[4] === '9') {
    digits = digits.slice(0, 4) + digits.slice(5);
  }
  return digits;
}

/** Gera um código numérico de 6 dígitos para o OTP reverso. */
export function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
