import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Promotion } from '../types';
import { ArrowRight, ChevronLeft, ChevronRight, Tag, Zap } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'motion/react';

const slideVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
    scale: 0.98,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      x: { type: 'spring', stiffness: 320, damping: 32 },
      opacity: { duration: 0.28 },
      scale: { duration: 0.28 },
    },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? '-100%' : '100%',
    opacity: 0,
    scale: 0.98,
    transition: {
      x: { type: 'spring', stiffness: 320, damping: 32 },
      opacity: { duration: 0.22 },
      scale: { duration: 0.22 },
    },
  }),
};

export default function PromotionalCarousel() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [[currentIndex, direction], setPage] = useState<[number, number]>([0, 0]);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const navigate = useNavigate();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function loadPromos() {
      try {
        setLoading(true);
        const res = await api.getPromotions();
        setPromotions(res.results);
      } catch (err) {
        console.error('Failed to load promotions', err);
      } finally {
        setLoading(false);
      }
    }
    loadPromos();
  }, []);

  const paginate = (newDirection: number) => {
    if (promotions.length <= 1) return;
    setPage(([prevIndex]) => {
      let nextIndex = prevIndex + newDirection;
      if (nextIndex < 0) nextIndex = promotions.length - 1;
      if (nextIndex >= promotions.length) nextIndex = 0;
      return [nextIndex, newDirection];
    });
  };

  const goToIndex = (targetIndex: number) => {
    if (targetIndex === currentIndex) return;
    const newDir = targetIndex > currentIndex ? 1 : -1;
    setPage([targetIndex, newDir]);
  };

  // Auto advance every 5.5s unless paused
  useEffect(() => {
    if (promotions.length <= 1 || isPaused) return;
    timerRef.current = setInterval(() => {
      paginate(1);
    }, 5500);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [promotions.length, isPaused, currentIndex]);

  if (loading) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-10 pt-4">
        <div className="w-full h-48 sm:h-64 lg:h-72 bg-slate-200/80 dark:bg-slate-800/80 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (promotions.length === 0) return null;

  const currentPromo = promotions[currentIndex];

  const handleDragEnd = (_: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    const swipeThreshold = 50;
    const velocityThreshold = 400;
    if (info.offset.x < -swipeThreshold || info.velocity.x < -velocityThreshold) {
      paginate(1);
    } else if (info.offset.x > swipeThreshold || info.velocity.x > velocityThreshold) {
      paginate(-1);
    }
  };

  return (
    <div
      className="w-full px-4 sm:px-6 lg:px-10 pt-4 select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative rounded-3xl overflow-hidden shadow-md border border-slate-200/80 dark:border-slate-800 bg-slate-950 text-white min-h-[240px] sm:min-h-[290px] lg:min-h-[330px] flex items-center">
        
        {/* Animated Banner Slide with Gestures */}
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.25}
            onDragEnd={handleDragEnd}
            className="absolute inset-0 w-full h-full flex items-center cursor-grab active:cursor-grabbing"
          >
            {/* Background Image with Gradient Overlay scrim */}
            <div className="absolute inset-0 z-0 pointer-events-none">
              <img
                src={currentPromo.image}
                alt={currentPromo.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center scale-100 opacity-45 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-transparent" />
            </div>

            {/* Content Container */}
            <div className="relative z-10 p-6 sm:p-10 max-w-xl pointer-events-auto">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold tracking-wide mb-3 backdrop-blur-xs"
              >
                <Zap className="w-3.5 h-3.5 animate-pulse" />
                <span>{currentPromo.badge}</span>
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.3 }}
                className="text-xl sm:text-3xl font-extrabold tracking-tight font-display mb-2 text-white leading-tight"
              >
                {currentPromo.title}
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className="text-xs sm:text-sm text-slate-300 mb-5 leading-relaxed line-clamp-2 max-w-md"
              >
                {currentPromo.subtitle}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.3 }}
                className="flex items-center gap-3 flex-wrap"
              >
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => navigate(`/category/${currentPromo.cta_category}`)}
                  className="px-5 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs sm:text-sm transition-colors shadow-lg shadow-emerald-950/40 flex items-center gap-2 cursor-pointer"
                >
                  <span>{currentPromo.cta_text}</span>
                  <ArrowRight className="w-4 h-4" />
                </motion.button>

                {currentPromo.code && (
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/10 backdrop-blur-xs border border-white/20 text-xs font-mono font-semibold text-emerald-200"
                  >
                    <Tag className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Use code: <strong className="text-white">{currentPromo.code}</strong></span>
                  </motion.div>
                )}
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Carousel Indicators & Controls */}
        {promotions.length > 1 && (
          <div className="absolute right-4 bottom-4 z-20 flex items-center gap-2.5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
            {/* Interactive Dot Pills with Smooth Expansion */}
            <div className="flex items-center gap-1.5 mr-1">
              {promotions.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => goToIndex(idx)}
                  aria-label={`Go to slide ${idx + 1}`}
                  className="p-1 cursor-pointer focus:outline-none"
                >
                  <motion.div
                    animate={{
                      width: idx === currentIndex ? 20 : 6,
                      backgroundColor: idx === currentIndex ? '#10B981' : 'rgba(255, 255, 255, 0.4)',
                    }}
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                    className="h-1.5 rounded-full"
                  />
                </button>
              ))}
            </div>

            {/* Prev Arrow */}
            <motion.button
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.85 }}
              onClick={() => paginate(-1)}
              aria-label="Previous promotion"
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </motion.button>

            {/* Next Arrow */}
            <motion.button
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.85 }}
              onClick={() => paginate(1)}
              aria-label="Next promotion"
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </motion.button>
          </div>
        )}

      </div>
    </div>
  );
}
