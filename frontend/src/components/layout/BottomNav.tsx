import { useNavigate, useLocation } from 'react-router-dom';
import { useUiStore } from '../../stores/uiStore';

const NAV_ITEMS = [
  { path: '/',             icon: '⚔️',  label: 'Hero'    },
  { path: '/quests',       icon: '📋',  label: 'Quests'  },
  { path: '/progress',     icon: '📊',  label: 'Progress'},
  { path: '/achievements', icon: '🏆',  label: 'Achieve' },
  { path: '/settings',     icon: '⚙️',  label: 'Settings'},
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const questBadgeCount = useUiStore((s) => s.questBadgeCount);

  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map((item) => {
        const isActive = location.pathname === item.path;
        const showBadge = item.path === '/quests' && questBadgeCount > 0;
        return (
          <button
            key={item.path}
            className={`nav-btn ${isActive ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className="ni">{item.icon}</span>
            <span>{item.label}</span>
            {showBadge && <span className="nav-badge">{questBadgeCount}</span>}
          </button>
        );
      })}
    </nav>
  );
}
