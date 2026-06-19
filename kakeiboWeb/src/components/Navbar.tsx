import { NavLink } from 'react-router-dom'
import { Home, Receipt, Grid3X3, PieChart, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const links: { to: string; label: string; Icon: LucideIcon }[] = [
  { to: '/', label: 'ホーム', Icon: Home },
  { to: '/expenses', label: '支出', Icon: Receipt },
  { to: '/table', label: '表', Icon: Grid3X3 },
  { to: '/stats', label: '統計', Icon: PieChart },
  { to: '/settings', label: '設定', Icon: Settings },
]

export const Navbar = () => (
  <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm border-t border-slate-200/80 dark:border-slate-700/50 z-10">
    <div className="flex justify-around max-w-lg mx-auto">
      {links.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex flex-col items-center py-2.5 px-1 gap-0.5 flex-1 transition-colors ${
              isActive
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-slate-400 dark:text-slate-400'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div className={`p-1 rounded-lg transition-colors ${isActive ? 'bg-indigo-50 dark:bg-indigo-950' : ''}`}>
                <Icon size={19} strokeWidth={isActive ? 2.2 : 1.7} />
              </div>
              <span className="text-[10px] font-medium">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </div>
  </nav>
)
