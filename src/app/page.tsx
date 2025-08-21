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
              <h1 className="text-white text-4xl md:text-5xl font-bold mb-2 drop-shadow-lg text-center" />
              <p className="text-white text-lg md:text-xl drop-shadow-md text-center" />
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
      <section className="py-16 relative">
        <div className="max-w-screen-xl mx-auto px-6 relative">
          <h2 className="text-3xl font-bold mb-6 text-center">Upcoming Events</h2>

           {/* Tombol panah kiri */}
          <button
            onClick={() => {
              if (!scrollRef.current) return;
              scrollRef.current.scrollBy({ left: -scrollRef.current.clientWidth * 0.8, behavior: 'smooth' });
            }}
            className="absolute left-0 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full shadow z-10"
            aria-label="Scroll Left"
          >
            <IoIosArrowBack size={24} />
          </button>

          {/* Scrollable container */}
          <div
            ref={scrollRef}
            className="flex space-x-6 overflow-x-auto scrollbar-hide scroll-smooth py-4 px-2"
          >
            <EventList />
          </div>

          {/* Tombol panah kanan */}
          <button
            onClick={() => {
              if (!scrollRef.current) return;
              scrollRef.current.scrollBy({ left: scrollRef.current.clientWidth * 0.8, behavior: 'smooth' });
            }}
            className="absolute right-0 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full shadow z-10"
            aria-label="Scroll Right"
          >
            <IoIosArrowForward size={24} />
          </button>

          <div className="text-center mt-8">
            <Link href="/events">
              <button className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-3 px-8 rounded-full shadow-lg transition transform hover:-translate-y-1 hover:scale-105">
                🎫 Lihat Semua Event
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Section kategori event vertical */}
      <section className="py-16 bg-white">
        <div className="max-w-screen-xl mx-auto px-6">
          <h2 className="text-3xl font-bold mb-8 text-center">Kategori Event</h2>

          <div className="flex flex-col gap-12">
            {['Workshop', 'Konser', 'Seminar'].map((cat) => (
              <div key={cat} className="space-y-4">
                <h3 className="text-2xl font-semibold">{cat}</h3>
                <div className="flex gap-6 overflow-x-auto scrollbar-hide">
                  <EventList category={cat.toLowerCase()} />
                </div>
              </div>
            ))}
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
