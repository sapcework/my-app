import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { ExpenseListPage } from './pages/ExpenseListPage'
import { ExpenseFormPage } from './pages/ExpenseFormPage'
import { StatsPage } from './pages/StatsPage'
import { CategoryPage } from './pages/CategoryPage'
import { BudgetPage } from './pages/BudgetPage'
import { RecurringPage } from './pages/RecurringPage'
import { TablePage } from './pages/TablePage'

export const App = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/expenses" element={<ExpenseListPage />} />
        <Route path="/expenses/new" element={<ExpenseFormPage />} />
        <Route path="/expenses/:id/edit" element={<ExpenseFormPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/table" element={<TablePage />} />
        <Route path="/categories" element={<CategoryPage />} />
        <Route path="/budget" element={<BudgetPage />} />
        <Route path="/recurring" element={<RecurringPage />} />
      </Route>
    </Routes>
  </BrowserRouter>
)
