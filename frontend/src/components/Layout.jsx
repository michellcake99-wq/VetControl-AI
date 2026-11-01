import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

export default function Layout() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  useEffect(() => {
    if (!menuAbierto) return;
    const onKey = (e) => e.key === 'Escape' && setMenuAbierto(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuAbierto]);

  return (
    <div className="app">
      <Sidebar abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />
      {menuAbierto && (
        <div
          className="overlay"
          onClick={() => setMenuAbierto(false)}
          aria-hidden="true"
        />
      )}
      <div className="app__main">
        <Topbar
          onAbrirMenu={() => setMenuAbierto(true)}
          menuAbierto={menuAbierto}
        />
        <main className="contenido">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
