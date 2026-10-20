'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type OtpResponse = { phoneVerified: boolean; code: string | null; whatsappNumber?: string };

/** Bloqueia a plataforma até o usuário provar que o telefone é dele: manda o código
 * gerado para o WhatsApp do rastrewin, nosso webhook confere remetente + código. */
export function PhoneVerifyModal({ userId, onVerified }: { userId: string; onVerified: () => void }) {
  const [data, setData] = useState<OtpResponse | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api<OtpResponse>(`/users/${userId}/otp`, { method: 'POST' }).then(setData).catch(() => setErr('Não foi possível gerar o código. Recarregue a página.'));
  }, [userId]);

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const r = await api<OtpResponse>(`/users/${userId}/otp`, { method: 'POST' });
        setData(r);
        if (r.phoneVerified) onVerified();
      } catch {}
    }, 4000);
    return () => clearInterval(poll);
  }, [userId, onVerified]);

  const waLink = data?.whatsappNumber && data.code
    ? `https://wa.me/${data.whatsappNumber.replace(/\D/g, '')}?text=${data.code}`
    : null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,12,20,.72)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 32, maxWidth: 420, width: '100%', display: 'grid', gap: 16, textAlign: 'center' }}>
        <h2 className="display" style={{ fontSize: 24 }}>Confirme seu WhatsApp</h2>
        <p style={{ color: 'var(--mut)', fontSize: 15 }}>
          Para liberar o acesso, envie o código abaixo pelo WhatsApp para o número {data?.whatsappNumber || 'do rastrewin'}.
        </p>
        {err && <div className="err">{err}</div>}
        {data && (
          <>
            <div style={{ font: '700 32px/1 var(--f-display)', letterSpacing: '.1em', background: 'var(--blue-bg)', borderRadius: 12, padding: '16px 0' }}>
              {data.code}
            </div>
            {waLink && (
              <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn-rainbow" style={{ textDecoration: 'none' }}>
                Abrir WhatsApp e enviar código
              </a>
            )}
            <span style={{ color: 'var(--mut)', fontSize: 13 }}>Assim que recebermos sua mensagem, o acesso libera automaticamente.</span>
          </>
        )}
      </div>
    </div>
  );
}
