import { BadRequestException, Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VISIBLE_AFTER_END_MS } from '../raffles/raffles.controller';
import { enroll } from '../plans';

/** Payload do webhook enviado pelo simpay quando uma cobrança é aprovada
 * (ver back-simpay charge-payment-link.use-case.ts -> notifyExternalWebhook). */
type SimpayWebhookDto = {
  event: string;
  customerEmail: string;
  orderId: string;
};

@Controller('payments')
export class PaymentsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Libera o plano básico quando o simpay confirma o pagamento do link de checkout. */
  @Post('webhook')
  async webhook(@Body() dto: SimpayWebhookDto, @Headers('x-simpay-token') token?: string) {
    const expected = process.env.SIMPAY_WEBHOOK_TOKEN;
    if (!expected || token !== expected) throw new UnauthorizedException('Token inválido');
    if (dto.event !== 'purchase_approved') return { ok: true };
    if (!dto.customerEmail || !dto.orderId) throw new BadRequestException('Payload incompleto');

    // idempotência: um orderId só ativa um plano uma vez
    const already = await this.prisma.user.findUnique({ where: { simpayOrderId: dto.orderId } });
    if (already) return { ok: true };

    const email = dto.customerEmail.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { ok: true }; // nada cadastrado com esse e-mail ainda; ignora

    await this.prisma.user.update({
      where: { id: user.id },
      data: { status: 'ACTIVE', plan: 'basico', paidAt: new Date(), simpayOrderId: dto.orderId },
    });

    const open = await this.prisma.raffle.findMany({
      where: { endsAt: { gt: new Date(Date.now() - VISIBLE_AFTER_END_MS) } },
      orderBy: { endsAt: 'asc' },
      select: { id: true },
    });
    await enroll(this.prisma, { id: user.id, plan: 'basico' }, open.map((r) => r.id));

    return { ok: true };
  }
}
