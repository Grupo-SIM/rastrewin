export function Logo({ badge }: { badge?: string }) {
  return (
    <span className="logo">
      <img src="/logos/Logo%20Rastrewin%2001.png" alt="Rastrewin" />
      {badge && <span className="admin-badge">{badge}</span>}
    </span>
  );
}
