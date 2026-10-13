'use client';

import { LogOut, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Logo from './Logo';

export default function Header({ title, onRefresh }: { title: string; onRefresh?: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  async function handleRefresh() {
    if (onRefresh) {
      setLoading(true);
      await onRefresh();
      setLoading(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-xs">
      <div className="flex items-center gap-2.5">
        <Logo className="w-9 h-9 shadow-xs rounded-2xl" />
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">{title}</h1>
          <p className="text-xs text-primary-600 font-semibold tracking-wide">Dar</p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {onRefresh && (
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-primary-600 rounded-lg hover:bg-orange-50 transition"
            title="Synchroniser"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-primary-600' : ''}`} />
          </button>
        )}
        <button
          onClick={handleLogout}
          className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition"
          title="Se déconnecter"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
