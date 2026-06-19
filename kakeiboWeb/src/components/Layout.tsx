import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'
import { ConfirmDialog } from './ConfirmDialog'
import { ToastHost } from './ToastHost'

export const Layout = () => (
  <div className="min-h-screen bg-slate-50 dark:bg-[#090912]">
    <main className="max-w-lg mx-auto pb-24 px-4">
      <Outlet />
    </main>
    <Navbar />
    <ConfirmDialog />
    <ToastHost />
  </div>
)
