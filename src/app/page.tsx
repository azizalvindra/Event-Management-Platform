'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { IoIosArrowBack, IoIosArrowForward } from 'react-icons/io';
import { EventList } from '@/components/EventList';
import Link from 'next/link';

const slides = ['/hero1.jpeg', '/hero2.jpg', '/hero3.jpeg'];

export default function HomePage() {
  const [current, setCurrent] = useState(0);
  const length = slides.length;

  // Ref container scroll horizontal upcoming events
  const scrollRef = useRef<HTMLDivElement>(null);

  const nextSlide = useCallback(() => {
    setCurrent((prev) => (prev + 1) % length);
  }, [length]);
    const prevSlide = useCallback(() => {
    setCurrent((prev) => (prev - 1 + length) % length);
  }, [length]);

  useEffect(() => {
    const timer = setInterval(nextSlide, 5000);
    return () => clearInterval(timer);
  }, [length, nextSlide]);


  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const { clientWidth, scrollLeft } = scrollRef.current;
    const scrollAmount = clientWidth * 0.8;
    if (direction === 'left') {
      scrollRef.current.scrollTo({ left: scrollLeft - scrollAmount, behavior: 'smooth' });
    } else {
      scrollRef.current.scrollTo({ left: scrollLeft + scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <main className="bg-gray-50 min-h-screen">
      {/* Hero Carousel */}
      <div className="relative w-full max-w-screen-xl h-[450px] mx-auto mt-8 rounded-xl overflow-hidden shadow-xl">
        {slides.map((src, i) => (
          <div
            key={i}
            className={`absolute inset-0 transition-opacity duration-700 ${
              i === current ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            <Image src={src} alt={`Slide ${i}`} fill className="object-cover" priority={i === 0} />
            <div className="absolute inset-0 bg-black/40 flex flex-col justify-center items-center px-6">
              <h1 className="text-white text-4xl md:text-5xl font-bold mb-2 drop-shadow-lg text-center">
                {/* Judul kosong, bisa diisi nanti */}
              </h1>
              <p className="text-white text-lg md:text-xl drop-shadow-md text-center">
                {/* Deskripsi kosong, bisa diisi nanti */}
              </p>
            </div>
          </div>
        ))}

        {/* Carousel arrows */}
        <button
          onClick={prevSlide}
          className="absolute z-20 left-6 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full shadow"
          aria-label="Previous Slide"
        >
          <IoIosArrowBack size={24} />
        </button>
        <button
          onClick={nextSlide}
          className="absolute z-20 right-6 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full shadow"
          aria-label="Next Slide"
        >
          <IoIosArrowForward size={24} />
        </button>

        {/* Carousel dots */}
        <div className="absolute z-20 bottom-6 left-1/2 -translate-x-1/2 flex space-x-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrent(idx)}
              className={`w-3 h-3 rounded-full transition ${
                idx === current ? 'bg-white' : 'bg-gray-400'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Upcoming Events dengan scroll horizontal */}
      <section className="py-16">
        <div className="max-w-screen-xl mx-auto px-6 relative">
          <h2 className="text-3xl font-bold mb-6 text-center">Upcoming Events</h2>

          {/* Tombol panah kiri */}
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full shadow z-10"
            aria-label="Scroll Left"
          >
            <IoIosArrowBack size={24} />
          </button>

          {/* Container scroll */}
          <div
            ref={scrollRef}
            className="flex space-x-6 overflow-x-auto scrollbar-hide scroll-smooth py-4 px-2"
            style={{ scrollBehavior: 'smooth' }}
          >
            {/* Panggil EventList, asumsikan sudah render card event */}
            <EventList />
          </div>

          {/* Tombol panah kanan */}
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full shadow z-10"
            aria-label="Scroll Right"
          >
            <IoIosArrowForward size={24} />
          </button>

          <div className="text-center mt-8">
            <Link href="/events">
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition">
                🎫 Lihat Semua Event
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Section kategori event */}
      <section className="py-16 bg-white">
        <div className="max-w-screen-xl mx-auto px-6">
          <h2 className="text-3xl font-bold mb-8 text-center">Kategori Event</h2>
          <div className="flex justify-center gap-8 flex-wrap">
            <Link href="/events?category=workshop">
              <div className="cursor-pointer bg-blue-100 text-blue-800 px-6 py-4 rounded-lg shadow-md hover:bg-blue-200 transition">
                Workshop
              </div>
            </Link>
            <Link href="/events?category=konser">
              <div className="cursor-pointer bg-green-100 text-green-800 px-6 py-4 rounded-lg shadow-md hover:bg-green-200 transition">
                Konser
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-8 mt-12 shadow-inner">
        <div className="max-w-screen-xl mx-auto px-6 text-center text-gray-600">
          &copy; {new Date().getFullYear()} EventJoy. All rights reserved.
        </div>
      </footer>
    </main>
  );
}
