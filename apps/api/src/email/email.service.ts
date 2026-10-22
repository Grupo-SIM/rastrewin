import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    // host de hospedagem compartilhada: cert TLS cobre o hostname real do servidor
    // (ex. pro120.dns-pro.com.br), não o domínio SMTP_HOST usado para conectar.
    tls: { rejectUnauthorized: false },
  });

  async sendWelcomeCredentials(to: string, name: string, password: string) {
    const loginUrl = `${process.env.WEB_ORIGIN}/login`;
    const safeName = escapeHtml(name.trim().split(/\s+/)[0] ?? '');
    const safeEmail = escapeHtml(to);
    const safePassword = escapeHtml(password);
    const safeLoginUrl = escapeHtml(loginUrl);
    try {
      await this.transport.sendMail({
        from: process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER,
        to,
        subject: 'Seu acesso à Rastrewin',
        html: `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@1&family=Manrope:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;background:#fafbfc;-webkit-font-smoothing:antialiased">
<div style="background:#fafbfc;padding:40px 16px;font-family:Manrope,system-ui,Arial,sans-serif;color:#08304c">
  <div style="max-width:600px;margin:0 auto">
    <div style="padding:0 8px;margin-bottom:20px;line-height:22px;white-space:nowrap">
      <span style="display:inline-block;vertical-align:middle;width:22px;height:22px;border-radius:7px;border:3px solid transparent;background:linear-gradient(#fff,#fff) padding-box,linear-gradient(135deg,#26c0ff,#e600c2 25%,#ff4940 45%,#ffa130 65%,#ffc837 80%,#00cc3d) border-box;box-sizing:border-box"></span>
      <span style="display:inline-block;vertical-align:middle;margin-left:10px;font:600 22px 'Plus Jakarta Sans',system-ui,Arial,sans-serif;letter-spacing:-.03em;color:#08304c">Rastrewin</span>
    </div>
    <div style="background:#fff;border:1px solid #eeeeee;border-radius:32px;overflow:hidden;box-shadow:0 0 0 1px rgba(0,0,0,.06),0 16px 16px -8px rgba(0,0,0,.03),0 10px 10px -5px rgba(0,0,0,.03),0 5px 5px -2.5px rgba(0,0,0,.03),0 1px 1px -.5px rgba(0,0,0,.03)">
      <div style="height:6px;line-height:6px;font-size:0;background:linear-gradient(90deg,#26c0ff,#e600c2 20%,#ff4940 40%,#ffa130 60%,#ffc837 80%,#00cc3d)">&nbsp;</div>
      <div style="padding:48px 44px 44px">
        <div style="margin-bottom:14px">
          <span style="display:inline-block;background:#d7ffe2;color:#0a7a35;font:700 13px Manrope,Arial,sans-serif;padding:7px 14px;border-radius:999px">Pagamento confirmado</span>
        </div>
        <h1 style="margin:0 0 14px;font-family:'Plus Jakarta Sans',system-ui,Arial,sans-serif;font-weight:600;letter-spacing:-.05em;line-height:1.02;font-size:48px;color:#08304c">Olá, ${safeName}! Seja <span style="font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-weight:400;font-size:1.13em;letter-spacing:-.01em;background:linear-gradient(90deg,#26c0ff,#e600c2 20%,#ff4940 40%,#ffa130 60%,#ffc837 80%,#00cc3d);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;padding:0 .07em 0 .02em">bem-vindo</span></h1>
        <p style="margin:0 0 28px;font:500 17px/1.55 Manrope,Arial,sans-serif;color:#353535">Seu pagamento foi confirmado e sua conta já está ativa. Use os dados abaixo para entrar:</p>
        <div style="background:#f6f7f9;border-radius:24px;padding:10px;margin-bottom:28px">
          <div style="background:#fff;border-radius:18px;padding:16px 22px;box-shadow:0 0 0 1px rgba(0,0,0,.07);margin-bottom:8px">
            <span style="display:block;font:600 13px Manrope,Arial,sans-serif;color:#797979;margin-bottom:4px">E-mail</span>
            <span style="display:block;font:500 19px 'Plus Jakarta Sans',Arial,sans-serif;letter-spacing:-.02em;color:#08304c;word-break:break-all">${safeEmail}</span>
          </div>
          <div style="background:#fff;border-radius:18px;padding:16px 22px;box-shadow:0 0 0 1px rgba(0,0,0,.07)">
            <span style="display:block;font:600 13px Manrope,Arial,sans-serif;color:#797979;margin-bottom:4px">Senha</span>
            <span style="display:block;font:600 22px 'SFMono-Regular',Menlo,Consolas,monospace;letter-spacing:.06em;color:#08304c;word-break:break-all">${safePassword}</span>
          </div>
        </div>
        <div style="margin-bottom:28px">
          <a href="${safeLoginUrl}" style="display:inline-block;background:#2c2c2c;color:#fff;border-radius:999px;padding:18px 34px;font:600 17px Manrope,Arial,sans-serif;text-decoration:none">Entrar na plataforma</a>
          <div style="margin-top:14px;font:500 14px/1.5 Manrope,Arial,sans-serif;color:#797979">Ou acesse: <a href="${safeLoginUrl}" style="color:#084e72">${safeLoginUrl}</a></div>
        </div>
        <div style="border-top:1px solid #eeeeee;padding-top:22px;font:500 14px/1.55 Manrope,Arial,sans-serif;color:#585858">Por segurança, recomendamos não compartilhar sua senha com ninguém.</div>
      </div>
    </div>
    <div style="padding:20px 8px 0;font:500 13px/1.6 Manrope,Arial,sans-serif;color:#797979;text-align:center">Você recebeu este e-mail porque se cadastrou na Rastrewin.</div>
  </div>
</div>
</body>
</html>`,
      });
    } catch (err) {
      // falha de SMTP não pode travar a liberação do plano
      this.logger.error(`Falha ao enviar e-mail de boas-vindas para ${to}: ${(err as Error).message}`);
    }
  }

  async sendPasswordResetCode(to: string, name: string, code: string) {
    const safeName = escapeHtml(name.trim().split(/\s+/)[0] ?? '');
    const safeCode = escapeHtml(code);
    const gradient = 'linear-gradient(90deg,#26c0ff,#e600c2 20%,#ff4940 40%,#ffa130 60%,#ffc837 80%,#00cc3d)';
    try {
      await this.transport.sendMail({
        from: process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER,
        to,
        subject: 'Seu código para redefinir a senha',
        html: `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@1&family=Manrope:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;background:#fafbfc;-webkit-font-smoothing:antialiased">
<div style="background:#fafbfc;padding:40px 16px;font-family:Manrope,system-ui,Arial,sans-serif;color:#08304c">
  <div style="max-width:600px;margin:0 auto">
    <div style="padding:0 8px;margin-bottom:20px;line-height:22px;white-space:nowrap">
      <span style="display:inline-block;vertical-align:middle;width:22px;height:22px;border-radius:7px;border:3px solid transparent;background:linear-gradient(#fff,#fff) padding-box,linear-gradient(135deg,#26c0ff,#e600c2 25%,#ff4940 45%,#ffa130 65%,#ffc837 80%,#00cc3d) border-box;box-sizing:border-box"></span>
      <span style="display:inline-block;vertical-align:middle;margin-left:10px;font:600 22px 'Plus Jakarta Sans',system-ui,Arial,sans-serif;letter-spacing:-.03em;color:#08304c">Rastrewin</span>
    </div>
    <div style="background:#fff;border:1px solid #eeeeee;border-radius:32px;overflow:hidden;box-shadow:0 0 0 1px rgba(0,0,0,.06),0 16px 16px -8px rgba(0,0,0,.03),0 10px 10px -5px rgba(0,0,0,.03),0 5px 5px -2.5px rgba(0,0,0,.03),0 1px 1px -.5px rgba(0,0,0,.03)">
      <div style="height:6px;line-height:6px;font-size:0;background:${gradient}">&nbsp;</div>
      <div style="padding:48px 44px 44px">
        <div style="margin-bottom:14px">
          <span style="display:inline-block;background:#e6f4fb;color:#084e72;font:700 13px Manrope,Arial,sans-serif;padding:7px 14px;border-radius:999px">Redefinição de senha</span>
        </div>
        <h1 style="margin:0 0 14px;font-family:'Plus Jakarta Sans',system-ui,Arial,sans-serif;font-weight:600;letter-spacing:-.05em;line-height:1.02;font-size:48px;color:#08304c">Olá, ${safeName}! Seu <span style="font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-weight:400;font-size:1.13em;letter-spacing:-.01em;background:${gradient};-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;padding:0 .07em 0 .02em">código</span></h1>
        <p style="margin:0 0 28px;font:500 17px/1.55 Manrope,Arial,sans-serif;color:#353535">Use o código abaixo para criar uma nova senha. Ele vale por 15 minutos.</p>
        <div style="background:#f6f7f9;border-radius:24px;padding:10px;margin-bottom:28px">
          <div style="background:#fff;border-radius:18px;padding:22px;box-shadow:0 0 0 1px rgba(0,0,0,.07);text-align:center">
            <span style="display:block;font:600 36px 'SFMono-Regular',Menlo,Consolas,monospace;letter-spacing:.3em;color:#08304c;padding-left:.3em">${safeCode}</span>
          </div>
        </div>
        <div style="border-top:1px solid #eeeeee;padding-top:22px;font:500 14px/1.55 Manrope,Arial,sans-serif;color:#585858">Se você não pediu para redefinir a senha, ignore este e-mail. Sua senha atual continua a mesma.</div>
      </div>
    </div>
    <div style="padding:20px 8px 0;font:500 13px/1.6 Manrope,Arial,sans-serif;color:#797979;text-align:center">Você recebeu este e-mail porque alguém solicitou a redefinição de senha na Rastrewin.</div>
  </div>
</div>
</body>
</html>`,
      });
    } catch (err) {
      this.logger.error(`Falha ao enviar código de redefinição para ${to}: ${(err as Error).message}`);
    }
  }
}
