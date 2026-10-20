import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_IDS, checkoutUrlFor } from '../plans';
import { toPublicUser } from './user.view';
import { generateOtpCode } from '../auth/phone.util';

class RegisterDto {
  @IsString() @MinLength(2) name: string;
  @IsEmail() email: string;
  @IsString() @MinLength(11) cpf: string;
  @IsString() @MinLength(8) phone: string;
  @IsString() @MinLength(2) city: string;
  @IsString() @MinLength(3) pix: string;
  @IsIn(PLAN_IDS) plan: string;
}

@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  /** Cadastro: salva os dados como PENDING e devolve o link de checkout. A liberação do plano
   * (e a senha de acesso) só acontece quando o webhook de pagamento confirmar (ver PaymentsController). */
  @Post()
  async register(@Body() dto: RegisterDto) {
    const checkoutUrl = checkoutUrlFor(dto.plan);
    if (!checkoutUrl) throw new BadRequestException('Checkout não configurado para este plano');
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.upsert({
      where: { email },
      update: { ...dto, email, status: 'PENDING', paidAt: null },
      create: { ...dto, email, status: 'PENDING' },
    });
    return { ...toPublicUser(user), checkoutUrl };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return toPublicUser(user);
  }

  /** Gera (ou reaproveita) o código que o usuário precisa mandar pro WhatsApp do rastrewin
   * para validar o telefone. Idempotente enquanto não verificado, pra não mudar o código
   * a cada tela aberta. */
  @Post(':id/otp')
  async requestOtp(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    if (user.phoneVerified) return { phoneVerified: true, code: null };
    const code = user.otpCode ?? generateOtpCode();
    if (!user.otpCode) await this.prisma.user.update({ where: { id }, data: { otpCode: code } });
    return { phoneVerified: false, code, whatsappNumber: process.env.WHATSAPP_OTP_NUMBER ?? '' };
  }
}
