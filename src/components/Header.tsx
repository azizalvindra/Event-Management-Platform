'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { IoMenu, IoClose } from 'react-icons/io5';
import { useRouter } from 'next/navigation';
import { SearchBar } from './SearchBar';

export function Layout({ children, isLoggedIn }: { children: React.ReactNode; isLoggedIn: boolean }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  const navigate = (path: string) => {
    setSidebarOpen(false);
    router.push(path);
  };

  return (
    <>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white shadow-md flex items-center px-6 z-50">
        {/* Hamburger menu selalu muncul */}
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Toggle Sidebar"
          className="mr-4 text-2xl text-gray-700"
        >
          <IoMenu />
        </button>

        <Link href="/" className="flex items-center space-x-2">
          <Image src="/logo.png" alt="EventJoy Logo" width={32} height={32} />
          <span className="text-2xl font-bold text-gray-800 select-none">EventJoy</span>
        </Link>

        {/* Pakai komponen SearchBar */}
        <div className="hidden md:block flex-1 px-6">
          <SearchBar />
        </div>
      </header>

      {/* Sidebar & Overlay */}
      {sidebarOpen && (
        <>
          {/* Background overlay */}
        

          {/* Sidebar */}
          <aside className="fixed top-0 left-0 h-full w-64 bg-white shadow-md flex flex-col pt-20 px-6 z-50 overflow-y-auto">
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Close Sidebar"
              className="absolute top-4 right-4 text-2xl text-gray-700"
            >
              <IoClose />
            </button>

            <nav className="flex flex-col space-y-6 flex-grow">
              <button
                onClick={() => navigate('/')}
                className="text-lg font-semibold text-gray-800 hover:text-blue-600 text-left"
              >
                Beranda
              </button>
              <button
                onClick={() => navigate('/profile')}
                className="text-lg font-semibold text-gray-800 hover:text-blue-600 text-left"
              >
                Profile
              </button>
              <button
                onClick={() => navigate('/events')}
                className="text-lg font-semibold text-gray-800 hover:text-blue-600 text-left"
              >
                Events
              </button>
              <button
                onClick={() => navigate('/events/create')}
                className="text-lg font-semibold text-gray-800 hover:text-blue-600 text-left"
              >
                Create Events
              </button>
              {isLoggedIn ? (
                <button
                  onClick={() => navigate('/logout')}
                  className="mt-auto text-red-600 font-semibold hover:text-red-800 text-left"
                >
                  Logout
                </button>
              ) : (
                <button
                  onClick={() => navigate('/login')}
                  className="mt-auto text-blue-600 font-semibold hover:text-blue-800 text-left"
                >
                  Login
                </button>
              )}
            </nav>
          </aside>
        </>
      )}

      {/* Main content */}
      <main className="pt-16 min-h-screen bg-gray-50 relative z-0">
        {children}
      </main>
    </>
  );
}
