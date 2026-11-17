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
          <Search className="w-5 h-5 text-slate-400 dark:text-slate-400 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            aria-label={t('header.searchPlaceholder')}
            placeholder={t('header.searchPlaceholder')}
            className="w-full pl-11 pr-10 py-2.5 md:py-3 rounded-[14px] bg-slate-100 hover:bg-slate-200/60 focus:bg-white dark:bg-[#141b2b] dark:hover:bg-[#182032] dark:focus:bg-[#182032] text-sm text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700/80 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all placeholder:text-slate-500 dark:placeholder:text-slate-400 font-medium"
          />
          {searchInput && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setSearchInput('');
                setSuggestions([]);
              }}
              className="absolute right-3 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700/80 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
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
