import { BadRequestException, Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VISIBLE_AFTER_END_MS } from '../raffles/raffles.controller';
import { enroll } from '../plans';
import { generatePassword, hashPassword } from '../auth/password.util';
import { EmailService } from '../email/email.service';

/** Payload do webhook enviado pelo simpay quando uma cobrança é aprovada
 * (ver back-simpay charge-payment-link.use-case.ts -> notifyExternalWebhook). */
type SimpayWebhookDto = {
  event: string;
  customerEmail: string;
  orderId: string;
};

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  /** Libera o plano escolhido no cadastro quando o simpay confirma o pagamento do link de
   * checkout. No primeiro pagamento também cria a senha de acesso e envia por e-mail. */
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

    const isFirstActivation = !user.password;
    const plainPassword = isFirstActivation ? generatePassword() : undefined;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: 'ACTIVE',
        paidAt: new Date(),
        simpayOrderId: dto.orderId,
        ...(plainPassword ? { password: await hashPassword(plainPassword) } : {}),
      },
    });

    if (plainPassword) void this.email.sendWelcomeCredentials(user.email, user.name, plainPassword);

    const open = await this.prisma.raffle.findMany({
      where: { endsAt: { gt: new Date(Date.now() - VISIBLE_AFTER_END_MS) } },
      orderBy: { endsAt: 'asc' },
      select: { id: true },
    });
    await enroll(this.prisma, { id: user.id, plan: user.plan }, open.map((r) => r.id));

    return { ok: true };
  }
}
