interface HeaderProps {
  serviceOnline: boolean;
  onRefreshHealth?: () => void;
}

export function Header({ serviceOnline }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__brand">
        <div className="app-header__logo">M.</div>
        <div className="app-header__brand-info">
          <div className="app-header__title">M.DoT Enterprises</div>
          <div className="app-header__attribution">
            <span className="attribution-client">Shoeb Akther</span>
          </div>
        </div>
      </div>
      <div className="app-header__controls">
        <div className="page-format-badge">A4 (210 × 297 mm) · 300 DPI</div>
        <div className={`status-badge ${serviceOnline ? 'status-badge--online' : 'status-badge--offline'}`}>
          <span className="status-dot"></span>
          <span>{serviceOnline ? 'Engine Online' : 'Engine Offline'}</span>
        </div>
      </div>
    </header>
  );
}
