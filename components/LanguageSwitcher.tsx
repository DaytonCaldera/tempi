'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronUp, Globe } from 'lucide-react';
import { localeNames, locales, type Locale } from '@/i18n/config';
import { useLocaleSwitcher } from '@/i18n/useLocaleSwitcher';

export default function LanguageSwitcher() {
  const { locale, switchLocale } = useLocaleSwitcher();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close the dropdown when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleLanguage = (newLocale: Locale) => {
    switchLocale(newLocale);
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999]" ref={dropdownRef}>
      {/* Dropdown menu */}
      <div className={`absolute bottom-full right-0 mb-3 transition-all duration-300 origin-bottom-right ${
        isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4 pointer-events-none'
      }`}>
        <div className="bg-card/90 backdrop-blur-xl border border-line rounded-2xl p-1.5 shadow-2xl min-w-[140px]">
          {locales.map((code) => (
            <button
              key={code}
              onClick={() => toggleLanguage(code)}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                locale === code
                  ? 'bg-accent/10 text-accent'
                  : 'text-ink-muted hover:bg-subtle hover:text-ink'
              }`}
            >
              {localeNames[code]}
              {locale === code && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
            </button>
          ))}
        </div>
      </div>

      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition-all duration-500 shadow-xl ${
          isOpen 
            ? 'bg-accent border-accent text-on-accent'
            : 'bg-card/80 backdrop-blur-md border-line text-ink hover:border-line-strong'
        }`}
      >
        <Globe className={`w-4 h-4 transition-transform duration-500 ${isOpen ? 'rotate-[360deg]' : ''}`} />
        <span className="text-[10px] tracking-widest font-black uppercase">
          {localeNames[locale]}
        </span>
        <ChevronUp className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
}