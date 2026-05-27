import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'

export const Layout = () => (
  <div className="min-h-screen bg-gray-50">
    <main className="max-w-lg mx-auto pb-20 px-4">
      <Outlet />
    </main>
    <Navbar />
  </div>
)
