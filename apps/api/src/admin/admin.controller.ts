import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { uniqueWinnerName } from '../mock';
import { ensureWinners } from '../raffles/raffles.controller';
import { planLimit, usedToday } from '../plans';
import { AdminGuard } from '../auth/auth.guard';
import { toPublicUser } from '../users/user.view';

class UpdateRaffleDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) title?: string;
  @IsOptional() @IsString() winnerName?: string;
  @IsOptional() @IsString() winnerUserId?: string;
  @IsOptional() @IsBoolean() winnerIneligible?: boolean;
  @IsOptional() @IsString() @MaxLength(300) ineligibleReason?: string;
}

const WA_KEY = 'whatsappMessage';
const WA_DEFAULT = 'Olá, {nome}! Você foi o ganhador do sorteio "{sorteio}" ({site}). Podemos combinar a entrega do seu prêmio?';

class MessageDto {
  @IsString() @MinLength(1) @MaxLength(1000) text: string;
}

class EndDto {
  @IsInt() @Min(0) inSeconds: number;
}

@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('raffles')
  async list() {
    await ensureWinners(this.prisma);
    return this.prisma.raffle.findMany({ where: { endsAt: { gt: new Date(Date.now() - 48 * 3600 * 1000) } }, orderBy: { endsAt: 'asc' }, include: { _count: { select: { entries: true } } } });
  }

  /** Modelo da mensagem de WhatsApp enviada ao ganhador. Variáveis: {nome} {sorteio} {site} {premio}. */
  @Get('whatsapp-message')
  async getMessage() {
    const s = await this.prisma.setting.findUnique({ where: { key: WA_KEY } });
    return { text: s?.value ?? WA_DEFAULT, isDefault: !s, defaultText: WA_DEFAULT };
  }

  @Put('whatsapp-message')
  async setMessage(@Body() dto: MessageDto) {
    await this.prisma.setting.upsert({ where: { key: WA_KEY }, update: { value: dto.text }, create: { key: WA_KEY, value: dto.text } });
    return { text: dto.text, isDefault: false, defaultText: WA_DEFAULT };
  }

  @Get('users')
  async users() {
    // todo usuário cadastrado já passou pelo pagamento (paidAt é preenchido na criação)
    const users = await this.prisma.user.findMany({
      orderBy: { paidAt: 'desc' },
      include: { _count: { select: { entries: true } } },
    });
    const used = await usedToday(this.prisma);
    return users.map((u) => ({ ...toPublicUser(u), usedToday: used.get(u.id) ?? 0, limit: planLimit(u.plan) }));
  }

  private async find(id: string) {
    const r = await this.prisma.raffle.findUnique({ where: { id } });
    if (!r) throw new NotFoundException();
    return r;
  }

  /** Edita o título e/ou define o ganhador (string vazia limpa). Só altera o que foi enviado. */
  @Patch('raffles/:id')
  async setWinner(@Param('id') id: string, @Body() dto: UpdateRaffleDto) {
    await this.find(id);
    const data: { title?: string; winnerName?: string | null; winnerUserId?: string | null; winnerIneligible?: boolean; ineligibleReason?: string | null } = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.winnerName !== undefined) data.winnerName = dto.winnerName || null;
    if (dto.winnerUserId !== undefined) data.winnerUserId = dto.winnerUserId || null;
    if (dto.winnerIneligible !== undefined) data.winnerIneligible = dto.winnerIneligible;
    if (dto.ineligibleReason !== undefined) data.ineligibleReason = dto.ineligibleReason.trim() || null;
    // trocar ou remover o ganhador zera a inelegibilidade, a não ser que ela tenha sido enviada junto
    if ((dto.winnerName !== undefined || dto.winnerUserId !== undefined) && dto.winnerIneligible === undefined) {
      data.winnerIneligible = false;
      data.ineligibleReason = null;
    }
    return this.prisma.raffle.update({ where: { id }, data });
  }

  @Post('raffles/:id/draw')
  async draw(@Param('id') id: string) {
    const r = await this.find(id);
    const taken = await this.prisma.raffle.findMany({ where: { winnerName: { not: null }, NOT: { id } }, select: { winnerName: true } });
    const name = uniqueWinnerName(r.seed, new Set(taken.map((t) => t.winnerName as string)));
    return this.prisma.raffle.update({ where: { id }, data: { winnerName: name, winnerUserId: null, winnerIneligible: false, ineligibleReason: null } });
  }

  /** Útil para testes: faz o sorteio terminar em N segundos. */
  @Post('raffles/:id/end')
  async end(@Param('id') id: string, @Body() dto: EndDto) {
    await this.find(id);
    return this.prisma.raffle.update({ where: { id }, data: { endsAt: new Date(Date.now() + dto.inSeconds * 1000) } });
  }
}
