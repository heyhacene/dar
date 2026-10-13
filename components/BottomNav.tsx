'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, BookOpen, ShoppingCart, Settings } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname === '/login') return null;

  const links = [
    { href: '/planning', label: 'Planning', icon: CalendarDays },
    { href: '/recettes', label: 'Recettes', icon: BookOpen },
    { href: '/courses', label: 'Courses', icon: ShoppingCart },
    { href: '/settings', label: 'Compte', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-200 pb-safe">
      <div className="max-w-md mx-auto flex justify-around items-center h-16 px-2">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                isActive ? 'text-primary-600 font-semibold' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <div className={`p-1 rounded-xl transition ${isActive ? 'bg-primary-50' : ''}`}>
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
              </div>
              <span className="text-[11px] mt-0.5">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
