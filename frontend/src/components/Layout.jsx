import { NavLink, Outlet } from 'react-router-dom'
import TopNav from './TopNav'

const navItems = [
  { path: '/',           label: 'DASHBOARD',        icon: 'dashboard' },
  { path: '/players',    label: 'PLAYER SEARCH',    icon: 'search' },
  { path: '/lists',      label: 'SCOUTING LISTS',   icon: 'format_list_bulleted' },
  { path: '/similar',    label: 'SIMILAR PLAYERS',  icon: 'groups' },
  { path: '/talent',     label: 'EMERGING TALENT',  icon: 'star' },
  { path: '/team-style', label: 'TEAM STYLE',       icon: 'hub' },
  { path: '/scatter',    label: 'SCATTER PLOT',     icon: 'scatter_plot' },
  { path: '/rankings',   label: 'RANKINGS',         icon: 'leaderboard' },
  { path: '/weighting',  label: 'METRIC WEIGHTING', icon: 'tune' },
  { path: '/coverage',   label: 'DATA COVERAGE',    icon: 'database' },
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-background text-on-surface font-body">
      {/* Sidebar */}
      <aside className="h-screen w-64 fixed left-0 top-0 bg-[#091328] flex flex-col py-6 z-50 overflow-y-auto">
        {/* Logo */}
        <div className="px-8 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/20 rounded-lg flex items-center justify-center">
              <span
                className="material-symbols-outlined text-primary text-xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                hub
              </span>
            </div>
            <div>
              <h1 className="text-blue-400 font-headline font-black text-xl leading-none">ScoutIQ</h1>
              <p className="font-headline text-[10px] font-bold tracking-[0.05em] uppercase text-blue-500/60 mt-0.5">
                Beta
              </p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 pr-4">
          <ul className="space-y-0.5">
            {navItems.map(({ path, label, icon }) => (
              <li key={path}>
                <NavLink
                  to={path}
                  end={path === '/'}
                  className={({ isActive }) =>
                    isActive
                      ? 'bg-blue-600/10 text-blue-400 rounded-r-xl border-l-4 border-blue-500 translate-x-1 px-6 py-3 flex items-center gap-4 transition-all duration-300'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-[#192540] px-6 py-3 flex items-center gap-4 transition-all duration-300'
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className="material-symbols-outlined text-xl"
                        style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
                      >
                        {icon}
                      </span>
                      <span className="font-headline text-[10px] font-bold tracking-[0.05em]">
                        {label}
                      </span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer links */}
        <div className="border-t border-outline-variant/10 pt-4">
          <a className="text-slate-500 hover:text-slate-300 px-6 py-3 flex items-center gap-4 hover:bg-[#192540] transition-all duration-300 cursor-pointer">
            <span className="material-symbols-outlined text-xl">help</span>
            <span className="font-headline text-[10px] font-bold tracking-[0.05em] uppercase">Support</span>
          </a>
        </div>
      </aside>

      {/* Top nav */}
      <TopNav />

      {/* Main content */}
      <main className="ml-64 pt-14 min-h-screen">
        <Outlet />
      </main>
    </div>
  )
}
