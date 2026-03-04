import { Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="min-h-screen bg-[rgba(0,0,0,0.88)] font-serif">
      <div className=''>
      <Outlet />
      </div>
    </div>
  );
}