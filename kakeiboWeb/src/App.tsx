import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { PasscodeLock } from './components/PasscodeLock'
import { LoginPage } from './pages/LoginPage'
import { useTheme } from './hooks/useTheme'
import { usePasscodeStore } from './store/passcodeStore'
import { useAuthStore } from './store/authStore'

const HomePage        = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })))
const ExpenseListPage = lazy(() => import('./pages/ExpenseListPage').then(m => ({ default: m.ExpenseListPage })))
const ExpenseFormPage = lazy(() => import('./pages/ExpenseFormPage').then(m => ({ default: m.ExpenseFormPage })))
const StatsPage       = lazy(() => import('./pages/StatsPage').then(m => ({ default: m.StatsPage })))
const TablePage       = lazy(() => import('./pages/TablePage').then(m => ({ default: m.TablePage })))
const SettingsPage    = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const CategoryPage    = lazy(() => import('./pages/CategoryPage').then(m => ({ default: m.CategoryPage })))
const BudgetPage      = lazy(() => import('./pages/BudgetPage').then(m => ({ default: m.BudgetPage })))
const RecurringPage   = lazy(() => import('./pages/RecurringPage').then(m => ({ default: m.RecurringPage })))

const PageLoader = () => (
  <div className="flex items-center justify-center h-48">
    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
  </div>
)

const FullLoader = () => (
  <div className="min-h-screen bg-slate-50 dark:bg-[#090912] flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
  </div>
)

export const App = () => {
  useTheme()
  const { enabled } = usePasscodeStore()
  const [locked, setLocked] = useState(enabled)
  const { user, loading, init } = useAuthStore()

  useEffect(() => { init() }, [init])

  if (loading) return <FullLoader />
  if (!user) return <LoginPage />
  if (locked) return <PasscodeLock onUnlock={() => setLocked(false)} />

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/expenses" element={<ExpenseListPage />} />
            <Route path="/expenses/new" element={<ExpenseFormPage />} />
            <Route path="/expenses/:id/edit" element={<ExpenseFormPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/table" element={<TablePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/categories" element={<CategoryPage />} />
            <Route path="/budget" element={<BudgetPage />} />
            <Route path="/recurring" element={<RecurringPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
