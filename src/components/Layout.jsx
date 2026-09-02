import { NavLink, Outlet } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard, Package, ShoppingCart, ClipboardList,
  Receipt, Tags, LogOut, Menu, X, Trash2, HelpCircle, Megaphone
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import QuickSearch from './QuickSearch'


const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/log-sale', label: 'Log a Sale', icon: ShoppingCart },
  { to: '/orders', label: 'Orders', icon: ClipboardList },
  { to: '/stock-movements', label: 'Stock Movements', icon: ClipboardList },
  { to: '/transactions', label: 'Transactions', icon: Receipt },
  { to: '/ad-spend', label: 'Ad Spend', icon: Megaphone },
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/trash', label: 'Trash', icon: Trash2 },
  { to: '/help', label: 'Help', icon: HelpCircle },
]

export default function Layout() {
  const { profile, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex flex-col w-60 border-r border-line bg-white px-4 py-6">
        <SidebarContent profile={profile} signOut={signOut} />
      </aside>

      <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-line z-40 flex items-center justify-between px-4 py-3">
        <span className="font-display font-semibold text-ink">Stock Tracker</span>
        <button onClick={() => setMobileOpen(true)}><Menu size={22} /></button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-ink/40" onClick={() => setMobileOpen(false)}>
          <aside className="w-64 h-full bg-white px-4 py-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end mb-2">
              <button onClick={() => setMobileOpen(false)}><X size={20} /></button>
            </div>
            <SidebarContent profile={profile} signOut={signOut} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <main className="flex-1 pt-16 md:pt-0">
        <div className="hidden md:flex items-center justify-end px-8 py-4 border-b border-line bg-white">
          <QuickSearch />
        </div>
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
      <Walkthrough />
    </div>
  )
}

function SidebarContent({ profile, signOut, onNavigate }) {
  return (
    <>
      <div className="mb-8 px-2">
        <p className="font-display text-lg font-semibold text-ink">Stock Tracker</p>
        <p className="text-xs text-inkfade mt-0.5">{profile?.name || 'Loading…'}</p>
      </div>
      <nav className="flex-1 space-y-1">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive ? 'bg-berry text-white' : 'text-inkfade hover:bg-sand'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <button
        onClick={signOut}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-inkfade hover:bg-sand mt-4"
      >
        <LogOut size={18} />
        Sign out
      </button>
    </>
  )
}
