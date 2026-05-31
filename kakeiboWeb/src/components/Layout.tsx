import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'

export const Layout = () => (
  <div className="min-h-screen bg-slate-50 dark:bg-[#090912]">
    <main className="max-w-lg mx-auto pb-24 px-4">
      <Outlet />
    </main>
    <Navbar />
  </div>
)
