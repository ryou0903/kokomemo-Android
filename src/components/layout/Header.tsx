import { useNavigate, useLocation } from 'react-router-dom';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  rightAction?: {
    label: string;
    icon?: string;
    onClick: () => void;
  };
}

export function Header({ title, showBack, rightAction }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';

  // Glass style（SearchPageと統一）
  const glassButtonStyle = 'bg-white/80 backdrop-blur-xl shadow-lg border border-gray-200 rounded-full px-4 h-12 text-base font-medium text-text active:bg-white/90 transition-colors flex items-center justify-center';

  return (
    <header className="sticky top-0 z-30 bg-surface border-b border-border">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left side - Back button only */}
        <div className="flex items-center gap-2">
          {showBack && !isHome && (
            <button
              onClick={() => navigate(-1)}
              className={glassButtonStyle}
              aria-label="戻る"
            >
              戻る
            </button>
          )}
        </div>

        <h1 className="text-xl font-bold text-text absolute left-1/2 -translate-x-1/2">
          {title}
        </h1>

        {/* Right side - rightAction only (Home button removed) */}
        <div className="flex items-center gap-2">
          {rightAction && (
            <button
              onClick={rightAction.onClick}
              className={glassButtonStyle}
            >
              {rightAction.icon && <span className="text-lg mr-1">{rightAction.icon}</span>}
              <span>{rightAction.label}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

