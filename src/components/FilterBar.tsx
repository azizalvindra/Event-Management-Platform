'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import debounce from 'lodash.debounce';
import { eventData } from '@/data/eventData';
import { cn } from '@/lib/utils';

/**
 * FilterBar component:
 * - Search input with debounce
 * - Category select
 * - Location select
 * Updates query params and triggers navigation
 */
export function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialSearch = searchParams.get('search') || '';
  const initialCategory = searchParams.get('category') || '';
  const initialLocation = searchParams.get('location') || '';

  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory);
  const [location, setLocation] = useState(initialLocation);

  // derive unique categories and locations from eventData
  const categories = useMemo(
    () => Array.from(new Set(eventData.map((e) => e.category))),
    []
  );
  const locations = useMemo(
    () => Array.from(new Set(eventData.map((e) => e.location))),
    []
  );

  // apply filters by updating query string, wrapped in useCallback supaya stabil
  const applyFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    if (location) params.set('location', location);
    const query = params.toString();
    router.push(`/events${query ? `?${query}` : ''}`);
  }, [search, category, location, router]);

  // debounce the applyFilters call, hanya tergantung applyFilters
  const debouncedApply = useMemo(() => debounce(applyFilters, 500), [applyFilters]);

  // jalankan debounce saat applyFilters berubah, cleanup cancel di return
  useEffect(() => {
    debouncedApply();
    return () => {
      debouncedApply.cancel();
    };
  }, [debouncedApply]);

  return (
    <div className="flex flex-col md:flex-row gap-4 mb-6 max-w-[1200px] mx-auto px-4">
      <input
        type="text"
        placeholder="Cari event..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={cn(
          'flex-1 border rounded px-4 py-2 focus:outline-none focus:ring',
          search ? 'border-blue-500' : 'border-gray-300'
        )}
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="border rounded px-4 py-2 focus:outline-none focus:ring"
      >
        <option value="">Semua Kategori</option>
        {categories.map((cat) => (
          <option key={cat} value={cat}> {cat} </option>
        ))}
      </select>
      <select
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        className="border rounded px-4 py-2 focus:outline-none focus:ring"
      >
        <option value="">Semua Lokasi</option>
        {locations.map((loc) => (
          <option key={loc} value={loc}> {loc} </option>
        ))}
      </select>
    </div>
  );
}
