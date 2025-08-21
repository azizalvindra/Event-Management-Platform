//src/components/Header.tsx

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { IoMenu, IoClose } from 'react-icons/io5';
import { useRouter } from 'next/navigation';
import { SearchBar } from './SearchBar';
import { createClient, User } from '@supabase/supabase-js';

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
);

type LayoutProps = {
  children: React.ReactNode;
  isLoggedIn?: boolean;
};

export function Layout({ children, isLoggedIn = false }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    // Cek user & role saat pertama kali load (hanya jika parent tidak sudah menyatakan isLoggedIn)
    const getUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!mounted) return;
        setUser(data?.user ?? null);

        if (data?.user) {
          const userRole = (data.user.user_metadata as { role?: string } | undefined)?.role ?? null;
          setRole(userRole);
        } else {
          setRole(null);
        }
      } catch {
        if (!mounted) return;
        setUser(null);
        setRole(null);
      }
    };

    if (!isLoggedIn) {
      getUser();
    }

    // Listen perubahan login/logout
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setRole((session?.user?.user_metadata as { role?: string } | undefined)?.role ?? null);
    });

    return () => {
      mounted = false;
      // unsubscribe defensif (beberapa versi supabase mungkin berbeda shape)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (listener as any)?.subscription?.unsubscribe?.();
    };
  }, [isLoggedIn]);

  const navigate = (path: string) => {
    setSidebarOpen(false);
    router.push(path);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    navigate('/');
  };

  const showAsLoggedIn = isLoggedIn || Boolean(user);

  return (
    <>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white shadow-md flex items-center px-6 z-50">
        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Toggle Sidebar"
          className="mr-4 text-2xl text-gray-700"
        >
          <IoMenu />
        </button>

        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <Image src="/logo.png" alt="EventJoy Logo" width={32} height={32} />
          <span className="text-2xl font-bold text-gray-800 select-none">
            EventJoy
          </span>
        </Link>

        {/* SearchBar */}
        <div className="hidden md:block flex-1 px-6">
          <SearchBar />
        </div>

        {/* Tombol kanan atas */}
        <div className="flex items-center space-x-4">
          {showAsLoggedIn ? (
            <button
              onClick={handleLogout}
              className="px-4 py-2 border border-red-400 text-red-500 rounded-lg hover:bg-red-50 hover:scale-105 transition-transform duration-200"
            >
              Logout
            </button>
          ) : (
            <>
              <Link
                href="/login"
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 hover:scale-105 transition duration-200"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:shadow-md hover:scale-105 transition duration-200"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Sidebar */}
      {sidebarOpen && (
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

            {/* Jika admin atau EO tampilkan Dashboard */}
            {role === 'admin' || role === 'event_organizer' ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="text-lg font-semibold text-gray-800 hover:text-blue-600 text-left"
              >
                Dashboard
              </button>
            ) : null}
          </nav>
        </aside>
      )}

      {/* Main content */}
      <main className="pt-16 min-h-screen bg-gray-50 relative z-0">
        {children}
      </main>
    </>
  );
}

