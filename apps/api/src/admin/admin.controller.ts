import { Body, CanActivate, Controller, ExecutionContext, Get, Injectable, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { randomWinnerName } from '../mock';

@Injectable()
class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    return req.headers['x-admin-key'] === (process.env.ADMIN_KEY ?? 'admin123');
  }
}

class UpdateRaffleDto {
  @IsOptional() @IsString() winnerName?: string;
  @IsOptional() @IsString() winnerUserId?: string;
}

class EndDto {
  @IsInt() @Min(0) inSeconds: number;
}

@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('raffles')
  list() {
    return this.prisma.raffle.findMany({ orderBy: { endsAt: 'asc' }, include: { _count: { select: { entries: true } } } });
  }

  @Get('users')
  users() {
    return this.prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  }

  private async find(id: string) {
    const r = await this.prisma.raffle.findUnique({ where: { id } });
    if (!r) throw new NotFoundException();
    return r;
  }

  /** Define (ou limpa, com string vazia) o ganhador do sorteio. */
  @Patch('raffles/:id')
  async setWinner(@Param('id') id: string, @Body() dto: UpdateRaffleDto) {
    await this.find(id);
    return this.prisma.raffle.update({
      where: { id },
      data: { winnerName: dto.winnerName || null, winnerUserId: dto.winnerUserId || null },
    });
  }

  @Post('raffles/:id/draw')
  async draw(@Param('id') id: string) {
    const r = await this.find(id);
    return this.prisma.raffle.update({ where: { id }, data: { winnerName: randomWinnerName(r.seed), winnerUserId: null } });
  }

  /** Útil para testes: faz o sorteio terminar em N segundos. */
  @Post('raffles/:id/end')
  async end(@Param('id') id: string, @Body() dto: EndDto) {
    await this.find(id);
    return this.prisma.raffle.update({ where: { id }, data: { endsAt: new Date(Date.now() + dto.inSeconds * 1000) } });
  }
}
