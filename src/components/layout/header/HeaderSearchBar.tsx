import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Search, X } from 'lucide-react';
import { useDebounce } from '../../../hooks';
import { translateCategoryName, TranslatorFn } from '../../../i18n';
import { productService } from '../../../services';
import { AutocompleteCategory, AutocompleteSuggestion, Language } from '../../../types';

interface HeaderSearchBarProps {
  language: Language;
  formatPrice: (amount: number) => string;
  t: TranslatorFn;
}

export default function HeaderSearchBar({ language, formatPrice, t }: HeaderSearchBarProps) {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 220);
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [categoriesFound, setCategoriesFound] = useState<AutocompleteCategory[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const query = debouncedSearch.trim();
    if (!query) {
      setSuggestions([]);
      setCategoriesFound([]);
      return;
    }

    let cancelled = false;
    productService
      .getAutocomplete(query)
      .then((res) => {
        if (!cancelled) {
          setSuggestions(res.suggestions || []);
          setCategoriesFound(res.categories || []);
        }
      })
      .catch((err) => console.error('Autocomplete error', err));

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (event.key === 'Escape') {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setShowDropdown(false);
      navigate(`/search?q=${encodeURIComponent(searchInput.trim())}`);
    }
  };

  const handleSelectSuggestion = (productName: string) => {
    setSearchInput(productName);
    setShowDropdown(false);
    navigate(`/search?q=${encodeURIComponent(productName)}`);
  };

  const handleSelectCategory = (slug: string) => {
    setShowDropdown(false);
    navigate(`/category/${slug}`);
  };

  return (
    <div ref={searchContainerRef} className="order-4 md:order-3 w-full md:w-auto md:flex-1 min-w-0 relative">
      <form onSubmit={handleSearchSubmit} className="relative" role="search">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-[#6B7280] dark:text-slate-400 absolute left-3.5 pointer-events-none stroke-[2]" />
          <input
            ref={inputRef}
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            aria-label="Search fresh veggies, tech accessories, books..."
            placeholder="Search fresh veggies, tech accessories, books..."
            className="w-full pl-10 pr-12 py-2.5 h-11 rounded-[12px] bg-[#F3F4F6] hover:bg-slate-200/60 focus:bg-white dark:bg-[#141b2b] dark:hover:bg-[#182032] dark:focus:bg-[#182032] text-sm text-[#111827] dark:text-slate-100 border border-transparent focus:border-[#00875A] focus:ring-2 focus:ring-[#00875A]/20 focus:outline-none transition-all placeholder:text-[#6B7280] dark:placeholder:text-slate-400 font-medium"
          />
          {searchInput ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setSearchInput('');
                setSuggestions([]);
              }}
              className="absolute right-3 p-1 rounded-md text-[#6B7280] hover:text-[#111827] dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700/80 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <div className="absolute right-3 hidden sm:flex items-center pointer-events-none select-none">
              <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[5px] bg-white dark:bg-[#1f2937] text-[10px] font-semibold text-[#6B7280] dark:text-slate-400 border border-slate-200 dark:border-slate-700 shadow-2xs">
                <span className="text-[11px]">⌘</span>K
              </kbd>
            </div>
          )}
        </div>
      </form>

      {showDropdown && (searchInput.trim().length > 0 || suggestions.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#111726] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/80 p-3 z-50">
          {categoriesFound.length > 0 && (
            <div className="mb-3 pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2">
                {t('header.categories')}
              </span>
              <div className="mt-1.5 flex flex-wrap gap-1.5 px-1">
                {categoriesFound.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectCategory(cat.slug)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer"
                  >
                    {translateCategoryName(cat.slug, cat.name, language)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {suggestions.length > 0 ? (
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2">
                {t('header.matchingProducts')}
              </span>
              <div className="mt-1 space-y-1 max-h-80 overflow-y-auto">
                {suggestions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(item.name)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={item.image_url}
                        alt={item.name}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                        className="w-10 h-10 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {item.unit} · {translateCategoryName(item.category || '', item.category || '', language)}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums shrink-0 ml-3">
                      {formatPrice(item.price)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : searchInput.trim().length > 1 ? (
            <div className="py-5 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('header.noMatches', { query: searchInput })}
              </p>
              <button
                type="button"
                onClick={handleSearchSubmit}
                className="mt-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>{t('header.searchAllCatalog')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
