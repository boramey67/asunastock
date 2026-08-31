import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, ScanBarcode, ClipboardList,
  ArrowLeftRight, Wallet, Tags, LogOut, Menu, X,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/sale', label: 'Log a Sale', icon: ScanBarcode },
  { to: '/orders', label: 'Orders', icon: ClipboardList },
  { to: '/stock-movements', label: 'Stock Movements', icon: ArrowLeftRight },
  { to: '/transactions', label: 'Transactions', icon: Wallet },
    { to: '/ad-spend', label: 'Ad Spend', icon: Megaphone },
]

export default function Layout({ children }) {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const NavLinks = () => (
    <>
      {navItems.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-berry text-cream'
                : 'text-inkfade hover:bg-sand hover:text-ink'
            }`
          }
        >
          <Icon size={18} strokeWidth={2} />
          {label}
        </NavLink>
      ))}
    </>
  )

  return (
    <div className="min-h-screen bg-cream flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-64 shrink-0 border-r border-line bg-cream px-4 py-6">
        <div className="px-2 mb-8">
          <h1 className="font-display text-2xl font-semibold text-berry">Stock Tracker</h1>
        </div>
        <nav className="flex-1 space-y-1">
          <NavLinks />
        </nav>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-inkfade hover:bg-sand hover:text-ink transition-colors"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </aside>

      {/* Mobile topbar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-cream border-b border-line flex items-center justify-between px-4 h-14">
        <h1 className="font-display text-xl font-semibold text-berry">Stock Tracker</h1>
        <button onClick={() => setMobileOpen(true)} className="p-2 text-ink">
          <Menu size={22} />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="w-72 bg-cream h-full px-4 py-6 flex flex-col border-r border-line">
            <div className="flex items-center justify-between px-2 mb-8">
              <h1 className="font-display text-xl font-semibold text-berry">Stock Tracker</h1>
              <button onClick={() => setMobileOpen(false)} className="p-1 text-ink">
                <X size={22} />
              </button>
            </div>
            <nav className="flex-1 space-y-1">
              <NavLinks />
            </nav>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-inkfade hover:bg-sand hover:text-ink"
            >
              <LogOut size={18} />
              Sign out
            </button>
          </div>
          <div className="flex-1 bg-ink/30" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 pt-14 md:pt-0">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
