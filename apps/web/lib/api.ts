export const API = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export type Raffle = {
  id: string; title: string; prize: string; site: string; siteColor: string; siteEmoji: string;
  seed: number; endsAt: string; participants: number; ended: boolean;
  winnerName: string | null; winnerUserId: string | null; winnerIneligible: boolean; ineligibleReason: string | null; entered: boolean;
};

export type User = {
  id: string; name: string; email: string; plan: string; status: string; role: string;
  phoneVerified: boolean; expiresAt: string | null; checkoutUrl: string | null;
};

export async function api<T>(path: string, init?: RequestInit & { admin?: boolean }): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init?.admin) {
    const token = localStorage.getItem('userToken');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...headers, ...(init?.headers as object) } });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

export function fmtRemaining(ms: number) {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = String(Math.floor((s % 86400) / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${d > 0 ? d + 'd ' : ''}${h}:${m}:${sec}`;
}
