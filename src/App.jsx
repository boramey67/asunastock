import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import ProductForm from './pages/ProductForm'
import Categories from './pages/Categories'
import CategoryDetail from './pages/CategoryDetail'
import LogSale from './pages/LogSale'
import Orders from './pages/Orders'
import StockMovements from './pages/StockMovements'
import Transactions from './pages/Transactions'
import AdSpend from './pages/AdSpend'
import Trash from './pages/Trash'
import Help from './pages/Help'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-inkfade">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) return <div className="min-h-screen flex items-center justify-center text-inkfade">Loading…</div>

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="products/new" element={<ProductForm />} />
        <Route path="products/:id/edit" element={<ProductForm />} />
        <Route path="categories" element={<Categories />} />
        <Route path="categories/:id" element={<CategoryDetail />} />
        <Route path="log-sale" element={<LogSale />} />
        <Route path="orders" element={<Orders />} />
        <Route path="stock-movements" element={<StockMovements />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="ad-spend" element={<AdSpend />} />
        <Route path="trash" element={<Trash />} />
        <Route path="help" element={<Help />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
