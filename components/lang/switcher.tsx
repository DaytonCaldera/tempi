'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ChevronUp, Globe } from 'lucide-react'; // Asumiendo que usas lucide-react

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar el dropdown si haces click fuera de él
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const languages = [
    { code: 'es', label: 'Español' },
    { code: 'en', label: 'English' }
  ];

  const toggleLanguage = (newLocale: string) => {
    if (newLocale === locale) {
      setIsOpen(false);
      return;
    }
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;
    router.refresh();
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999]" ref={dropdownRef}>
      {/* Menú Desplegable */}
      <div className={`absolute bottom-full right-0 mb-3 transition-all duration-300 origin-bottom-right ${
        isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4 pointer-events-none'
      }`}>
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-1.5 shadow-2xl min-w-[140px]">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => toggleLanguage(lang.code)}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                locale === lang.code 
                  ? 'bg-jade-500/10 text-jade-400' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {lang.label}
              {locale === lang.code && <div className="w-1.5 h-1.5 rounded-full bg-jade-500 shadow-[0_0_8px_#10b981]" />}
            </button>
          ))}
        </div>
      </div>

      {/* Botón Principal (Trigger) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition-all duration-500 shadow-xl ${
          isOpen 
            ? 'bg-jade-500 border-jade-400 text-slate-950 shadow-jade-500/20' 
            : 'bg-slate-900/80 backdrop-blur-md border-slate-700/50 text-slate-200 hover:border-slate-500'
        }`}
      >
        <Globe className={`w-4 h-4 transition-transform duration-500 ${isOpen ? 'rotate-[360deg]' : ''}`} />
        <span className="text-[10px] tracking-widest font-black uppercase">
          {locale === 'es' ? 'Español' : 'English'}
        </span>
        <ChevronUp className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
}