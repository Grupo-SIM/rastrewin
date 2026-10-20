export function Logo({ badge }: { badge?: string }) {
  return (
    <span className="logo">
      <i />
      <b>Rastrewin</b>
      {badge && <span className="admin-badge">{badge}</span>}
    </span>
  );
}
