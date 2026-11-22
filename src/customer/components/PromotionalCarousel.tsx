import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeroBanner, Promotion } from '../../types';
import { useHeroBanners } from '../../hooks';
import { isExternalHttpUrl } from '../../utils';
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'motion/react';

export interface PromotionalCarouselProps {
  banners?: (HeroBanner | Promotion)[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export interface BannerSlideItem {
  id: string;
  imageUrl: string;
  targetUrl: string;
  altText: string;
  isActive?: boolean;
  order?: number;
}

const DEFAULT_PLACEHOLDER_BANNERS: BannerSlideItem[] = [
  {
    id: 'placeholder-hero-1',
    imageUrl: '/assets/images/hero_groceries_fresh_1794407355931.jpg',
    targetUrl: '/category/fruits-vegetables',
    altText: 'OyoPasal - Fast & Fresh Groceries in 10-15 Minutes',
  },
];

const slideVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      x: { type: 'spring', stiffness: 300, damping: 30 },
      opacity: { duration: 0.35 },
    },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? '-100%' : '100%',
    opacity: 0,
    transition: {
      x: { type: 'spring', stiffness: 300, damping: 30 },
      opacity: { duration: 0.25 },
    },
  }),
};

export default function PromotionalCarousel({
  banners: propBanners,
  loading: propLoading,
  error: _propError,
  onRetry: _onRetry,
}: PromotionalCarouselProps) {
  const isControlled = propBanners !== undefined;
  const fallback = useHeroBanners({ enabled: !isControlled });
  const rawBanners = propBanners ?? ((Array.isArray(fallback.heroBanners) && fallback.heroBanners.length > 0) ? fallback.heroBanners : (fallback.banners || []));
  const loading = isControlled ? Boolean(propLoading) : fallback.loading;

  const navigate = useNavigate();
  const [[currentIndex, direction], setPage] = useState<[number, number]>([0, 0]);
  const [isHovered, setIsHovered] = useState(false);
  const [isManualPaused, setIsManualPaused] = useState(false);
  const [imageFailures, setImageFailures] = useState<Record<string, boolean>>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const slides: BannerSlideItem[] = useMemo(() => {
    if (rawBanners && rawBanners.length > 0) {
      const activeBanners = rawBanners.filter((b) => (b as { is_active?: boolean }).is_active !== false);
      if (activeBanners.length > 0) {
        return activeBanners.map((b, index) => {
          const hero = b as Partial<HeroBanner>;
          const promo = b as Partial<Promotion>;

          let img = hero.image_url || hero.image || promo.image || '';
          if (img.startsWith('/src/assets/images/')) {
            img = img.replace('/src/assets/images/', '/assets/images/');
          }

          const dest = (
            hero.target_url ||
            promo.destination_url ||
            (promo.cta_category ? `/category/${promo.cta_category}` : '/')
          ).trim();

          const alt = hero.alt_text || promo.title || 'OyoPasal Promotional Banner';
          const order = hero.display_order ?? promo.sort_order ?? index;

          return {
            id: `hero-${hero.id || promo.id || index}`,
            imageUrl: img || DEFAULT_PLACEHOLDER_BANNERS[0].imageUrl,
            targetUrl: dest || '/',
            altText: alt,
            order,
          };
        });
      }
    }
    return DEFAULT_PLACEHOLDER_BANNERS;
  }, [rawBanners]);

  useEffect(() => {
    if (slides.length > 0 && currentIndex >= slides.length) {
      setPage([0, 0]);
    }
  }, [slides.length, currentIndex]);

  const paginate = (newDirection: number) => {
    if (slides.length <= 1) return;
    setPage(([prevIndex]) => {
      let nextIndex = prevIndex + newDirection;
      if (nextIndex < 0) nextIndex = slides.length - 1;
      if (nextIndex >= slides.length) nextIndex = 0;
      return [nextIndex, newDirection];
    });
  };

  const goToIndex = (targetIndex: number) => {
    if (targetIndex === currentIndex) return;
    const newDir = targetIndex > currentIndex ? 1 : -1;
    setPage([targetIndex, newDir]);
  };

  const toggleAutoPlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsManualPaused((prev) => !prev);
  };

  useEffect(() => {
    if (slides.length <= 1 || isHovered || isManualPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      paginate(1);
    }, 4500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [slides.length, isHovered, isManualPaused, currentIndex]);

  const currentSlide = slides[currentIndex] || DEFAULT_PLACEHOLDER_BANNERS[0];

  const handleSlideClick = (slide: BannerSlideItem, e: React.MouseEvent) => {
    e.preventDefault();
    const dest = slide.targetUrl?.trim() || '/';
    if (isExternalHttpUrl(dest)) {
      window.location.href = dest;
    } else {
      navigate(dest);
    }
  };

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    const swipeThreshold = 40;
    const velocityThreshold = 350;
    if (info.offset.x < -swipeThreshold || info.velocity.x < -velocityThreshold) {
      paginate(1);
    } else if (info.offset.x > swipeThreshold || info.velocity.x > velocityThreshold) {
      paginate(-1);
    }
  };

  const currentImageSrc = imageFailures[currentSlide.id]
    ? DEFAULT_PLACEHOLDER_BANNERS[0].imageUrl
    : currentSlide.imageUrl;

  return (
    <div
      className="w-full px-4 sm:px-6 lg:px-10 pt-4 select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative w-full rounded-2xl overflow-hidden shadow-sm border border-slate-200/80 dark:border-slate-800 bg-slate-950 h-[220px] sm:h-[300px] md:h-[380px] lg:h-[440px]">
        {loading && slides.length === 0 && (
          <div className="absolute inset-0 z-30 bg-slate-200/80 dark:bg-slate-800/80 animate-pulse rounded-2xl" />
        )}

        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={currentSlide.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className="absolute inset-0 block w-full h-full cursor-pointer overflow-hidden"
          >
            <a
              href={currentSlide.targetUrl}
              onClick={(e) => handleSlideClick(currentSlide, e)}
              className="block w-full h-full"
              aria-label={currentSlide.altText}
            >
              <img
                src={currentImageSrc}
                alt={currentSlide.altText}
                referrerPolicy="no-referrer"
                onError={() => {
                  setImageFailures((prev) => ({ ...prev, [currentSlide.id]: true }));
                }}
                className="w-full h-full object-cover object-center pointer-events-none transition-transform duration-700 ease-out hover:scale-[1.01]"
                draggable={false}
              />
            </a>
          </motion.div>
        </AnimatePresence>

        {slides.length > 1 && (
          <div
            className="absolute top-4 right-4 flex items-center gap-2 z-10 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                paginate(-1);
              }}
              aria-label="Previous slide"
              className="w-8 h-8 rounded-full bg-slate-900/65 hover:bg-slate-900/85 text-white backdrop-blur-sm shadow-md border border-white/10 flex items-center justify-center cursor-pointer transition-colors active:scale-90"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={toggleAutoPlay}
              aria-label={isManualPaused ? 'Play auto-rotation' : 'Pause auto-rotation'}
              className="w-8 h-8 rounded-full bg-slate-900/65 hover:bg-slate-900/85 text-white backdrop-blur-sm shadow-md border border-white/10 flex items-center justify-center cursor-pointer transition-colors active:scale-90"
            >
              {isManualPaused ? (
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              ) : (
                <Pause className="w-3.5 h-3.5 fill-current" />
              )}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                paginate(1);
              }}
              aria-label="Next slide"
              className="w-8 h-8 rounded-full bg-slate-900/65 hover:bg-slate-900/85 text-white backdrop-blur-sm shadow-md border border-white/10 flex items-center justify-center cursor-pointer transition-colors active:scale-90"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {slides.length > 1 && (
          <div
            className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/45 backdrop-blur-md border border-white/10 shadow-sm pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {slides.map((slide, idx) => {
              const isActive = idx === currentIndex;
              return (
                <button
                  key={slide.id || idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToIndex(idx);
                  }}
                  aria-label={`Go to slide ${idx + 1}`}
                  className="p-1 cursor-pointer focus:outline-none flex items-center justify-center"
                >
                  <motion.div
                    animate={{
                      width: isActive ? 22 : 6,
                      backgroundColor: isActive ? '#10B981' : 'rgba(255, 255, 255, 0.45)',
                    }}
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                    className="h-1.5 rounded-full"
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
