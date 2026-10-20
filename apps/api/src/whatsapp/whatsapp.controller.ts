import { Body, Controller, Logger, Post } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePhone } from '../auth/phone.util';

type EvolutionMessage = {
  key?: { remoteJid?: string; fromMe?: boolean };
  message?: { conversation?: string; extendedTextMessage?: { text?: string } };
};

/** A Evolution API varia o shape entre versões: evento pode vir em maiúsculo/minúsculo e o
 * payload da mensagem às vezes dentro de "data", às vezes "data" já é a mensagem, às vezes
 * um array. Aceita os formatos observados em produção em vez de travar num único shape. */
type EvolutionWebhookDto = {
  event?: string;
  data?: EvolutionMessage | EvolutionMessage[];
};

@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(private readonly prisma: PrismaService) {}

  /** OTP reverso: usuário manda o código pro WhatsApp do rastrewin; aqui a gente confere
   * se o remetente é o telefone cadastrado e se o texto bate com o código gerado. */
  @Post('webhook')
  async webhook(@Body() dto: EvolutionWebhookDto) {
    const event = (dto.event ?? '').toLowerCase();
    if (event !== 'messages.upsert') return { ok: true };

    const messages = Array.isArray(dto.data) ? dto.data : dto.data ? [dto.data] : [];
    for (const msg of messages) await this.handleMessage(msg);
    return { ok: true };
  }

  private async handleMessage(msg: EvolutionMessage) {
    if (!msg || msg.key?.fromMe) return;
    const remoteJid = msg.key?.remoteJid ?? '';
    const senderPhone = remoteJid.split('@')[0]?.replace(/\D/g, '');
    const text = (msg.message?.conversation ?? msg.message?.extendedTextMessage?.text ?? '').trim();
    if (!senderPhone || !/^\d{6}$/.test(text)) return;

    const normalized = normalizePhone(senderPhone);
    const candidates = await this.prisma.user.findMany({
      where: { phoneVerified: false, otpCode: text },
      select: { id: true, phone: true },
    });
    const match = candidates.find((u) => normalizePhone(u.phone) === normalized);
    if (!match) {
      this.logger.warn(`OTP ${text} recebido de ${normalized} sem usuário pendente correspondente`);
      return;
    }

    await this.prisma.user.update({ where: { id: match.id }, data: { phoneVerified: true, otpCode: null } });
    this.logger.log(`Telefone verificado para usuário ${match.id}`);
  }
}
