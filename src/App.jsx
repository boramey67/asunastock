import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import ProductForm from './pages/ProductForm'
import LogSale from './pages/LogSale'
import Orders from './pages/Orders'
import OrderDetail from './pages/OrderDetail'
import StockMovements from './pages/StockMovements'
import Transactions from './pages/Transactions'
import Categories from './pages/Categories'
import Help from './pages/Help'
import AdSpend from './pages/AdSpend'

function Protected({ children }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/products" element={<Protected><Products /></Protected>} />
          <Route path="/products/new" element={<Protected><ProductForm /></Protected>} />
          <Route path="/products/:id" element={<Protected><ProductForm /></Protected>} />
          <Route path="/sale" element={<Protected><LogSale /></Protected>} />
          <Route path="/orders" element={<Protected><Orders /></Protected>} />
          <Route path="/orders/:id" element={<Protected><OrderDetail /></Protected>} />
          <Route path="/stock-movements" element={<Protected><StockMovements /></Protected>} />
          <Route path="/transactions" element={<Protected><Transactions /></Protected>} />
          <Route path="/categories" element={<Protected><Categories /></Protected>} />
          <Route path="ad-spend" element={<AdSpend />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
