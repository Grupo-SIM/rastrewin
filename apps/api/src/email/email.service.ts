import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });

  async sendWelcomeCredentials(to: string, name: string, password: string) {
    try {
      await this.transport.sendMail({
        from: process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER,
        to,
        subject: 'Seu acesso à Rastrewin',
        html: `
          <p>Olá, ${name}!</p>
          <p>Seu pagamento foi confirmado e sua conta já está ativa. Use os dados abaixo para entrar:</p>
          <p><strong>E-mail:</strong> ${to}<br/><strong>Senha:</strong> ${password}</p>
          <p>Acesse: <a href="${process.env.WEB_ORIGIN}/login">${process.env.WEB_ORIGIN}/login</a></p>
        `,
      });
    } catch (err) {
      // falha de SMTP não pode travar a liberação do plano
      this.logger.error(`Falha ao enviar e-mail de boas-vindas para ${to}: ${(err as Error).message}`);
    }
  }
}
