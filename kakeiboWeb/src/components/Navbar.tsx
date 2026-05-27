import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'ホーム', icon: '🏠' },
  { to: '/expenses', label: '支出', icon: '💴' },
  { to: '/table', label: '表', icon: '📋' },
  { to: '/stats', label: '統計', icon: '📊' },
  { to: '/categories', label: 'カテゴリ', icon: '🏷️' },
  { to: '/budget', label: '予算', icon: '💰' },
  { to: '/recurring', label: '定期', icon: '🔁' },
]

export const Navbar = () => (
  <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10">
    <div className="flex justify-around max-w-lg mx-auto">
      {links.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex flex-col items-center py-2 px-1 gap-0.5 ${
              isActive ? 'text-blue-600' : 'text-gray-500'
            }`
          }
        >
          <span className="text-lg">{icon}</span>
          <span className="text-[10px]">{label}</span>
        </NavLink>
      ))}
    </div>
  </nav>
)
