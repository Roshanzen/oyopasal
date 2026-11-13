import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  DollarSign,
  Package,
  ShoppingBag,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Award,
  Sparkles,
  ExternalLink,
  Calendar,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  Layers,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Monthly Revenue Trend Datasets
interface MonthlyTrendPoint {
  month: string;
  shortMonth: string;
  revenue: number;
  orders: number;
  growth: number; // percentage vs prior month
  avgOrderValue: number;
}

const MONTHLY_DATA_12M: MonthlyTrendPoint[] = [
  { month: 'December 2025', shortMonth: 'Dec', revenue: 28500, orders: 72, growth: 12.4, avgOrderValue: 395 },
  { month: 'January 2026', shortMonth: 'Jan', revenue: 31200, orders: 81, growth: 9.5, avgOrderValue: 385 },
  { month: 'February 2026', shortMonth: 'Feb', revenue: 34800, orders: 88, growth: 11.5, avgOrderValue: 395 },
  { month: 'March 2026', shortMonth: 'Mar', revenue: 39400, orders: 98, growth: 13.2, avgOrderValue: 402 },
  { month: 'April 2026', shortMonth: 'Apr', revenue: 42100, orders: 102, growth: 6.8, avgOrderValue: 412 },
  { month: 'May 2026', shortMonth: 'May', revenue: 45600, orders: 110, growth: 8.3, avgOrderValue: 414 },
  { month: 'June 2026', shortMonth: 'Jun', revenue: 47900, orders: 115, growth: 5.0, avgOrderValue: 416 },
  { month: 'July 2026', shortMonth: 'Jul', revenue: 50400, orders: 121, growth: 5.2, avgOrderValue: 416 },
  { month: 'August 2026', shortMonth: 'Aug', revenue: 52300, orders: 124, growth: 3.8, avgOrderValue: 421 },
  { month: 'September 2026', shortMonth: 'Sep', revenue: 54900, orders: 130, growth: 5.0, avgOrderValue: 422 },
  { month: 'October 2026', shortMonth: 'Oct', revenue: 58200, orders: 138, growth: 6.0, avgOrderValue: 421 },
  { month: 'November 2026', shortMonth: 'Nov', revenue: 64800, orders: 152, growth: 11.3, avgOrderValue: 426 }
];

// Top-Performing Products Data
interface TopProduct {
  id: string;
  name: string;
  category: string;
  unit: string;
  unitsSold: number;
  revenue: number;
  sharePercent: number;
  growth: number;
  image: string;
  inStock: boolean;
}

const TOP_PRODUCTS_DATA: TopProduct[] = [
  {
    id: 'prod-cherry-tomatoes',
    name: 'Organic Cherry Tomatoes',
    category: 'Fruits & Vegetables',
    unit: '250g',
    unitsSold: 384,
    revenue: 36480,
    sharePercent: 28.4,
    growth: 24.2,
    image: '/src/assets/images/hero_groceries_fresh_1794407355931.jpg',
    inStock: true
  },
  {
    id: 'prod-sourdough',
    name: 'Artisan Sourdough Boule',
    category: 'Bakery & Dairy',
    unit: '450g loaf',
    unitsSold: 295,
    revenue: 53100,
    sharePercent: 22.8,
    growth: 18.5,
    image: '/src/assets/images/vendor_bakery_dairy_1794407355670.jpg',
    inStock: true
  },
  {
    id: 'prod-a2-milk',
    name: 'Himalayan A2 Cow Milk',
    category: 'Dairy & Eggs',
    unit: '1 Litre Glass Bottle',
    unitsSold: 278,
    revenue: 36140,
    sharePercent: 19.5,
    growth: 31.0,
    image: '/src/assets/images/promo_fresh_produce_1794407354982.jpg',
    inStock: true
  },
  {
    id: 'prod-spinach-hydro',
    name: 'Baby Hydroponic Spinach',
    category: 'Fresh Greens',
    unit: '200g box',
    unitsSold: 210,
    revenue: 25200,
    sharePercent: 15.6,
    growth: 14.8,
    image: '/src/assets/images/hero_groceries_fresh_1794407355931.jpg',
    inStock: true
  },
  {
    id: 'prod-raw-honey',
    name: 'Wild Forest Raw Honey',
    category: 'Organics & Pantry',
    unit: '350g jar',
    unitsSold: 142,
    revenue: 39760,
    sharePercent: 13.7,
    growth: 9.4,
    image: '/src/assets/images/promo_snacks_drinks_1794407356711.jpg',
    inStock: true
  }
];

// Category Sales Distribution Data
const CATEGORY_BREAKDOWN = [
  { name: 'Fruits & Vegetables', share: 38, revenue: 98450, color: '#10b981' }, // emerald-500
  { name: 'Bakery & Artisanal Bread', share: 26, revenue: 67340, color: '#f59e0b' }, // amber-500
  { name: 'Dairy & A2 Milk', share: 20, revenue: 51800, color: '#06b6d4' }, // cyan-500
  { name: 'Organic Pantry & Herbs', share: 16, revenue: 41450, color: '#8b5cf6' } // purple-500
];

// Hourly Dispatch Volume
const HOURLY_SALES = [
  { hour: '6 AM', orders: 12 },
  { hour: '8 AM', orders: 48 }, // Morning breakfast spike
  { hour: '10 AM', orders: 36 },
  { hour: '12 PM', orders: 28 },
  { hour: '2 PM', orders: 19 },
  { hour: '4 PM', orders: 32 },
  { hour: '6 PM', orders: 58 }, // Evening dinner rush
  { hour: '8 PM', orders: 44 },
  { hour: '10 PM', orders: 15 }
];

export default function SellerVisualSummary({ vendorName }: { vendorName?: string }) {
  const [timeframe, setTimeframe] = useState<'6m' | '12m'>('6m');
  const [hoveredPoint, setHoveredPoint] = useState<MonthlyTrendPoint | null>(null);
  const [hoveredProduct, setHoveredProduct] = useState<TopProduct | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<typeof CATEGORY_BREAKDOWN[0] | null>(null);

  const displayPoints = timeframe === '6m' ? MONTHLY_DATA_12M.slice(6) : MONTHLY_DATA_12M;

  // Compute Total Sales & Averages
  const totalPeriodRevenue = displayPoints.reduce((acc, p) => acc + p.revenue, 0);
  const totalPeriodOrders = displayPoints.reduce((acc, p) => acc + p.orders, 0);
  const latestMonth = displayPoints[displayPoints.length - 1];
  const priorMonth = displayPoints[displayPoints.length - 2];
  const momGrowth = priorMonth ? ((latestMonth.revenue - priorMonth.revenue) / priorMonth.revenue) * 100 : 0;
  const avgOrderValue = Math.round(totalPeriodRevenue / Math.max(1, totalPeriodOrders));

  // Chart dimensions & coordinates calculation for SVG Area Chart
  const svgWidth = 680;
  const svgHeight = 220;
  const padLeft = 55;
  const padRight = 25;
  const padTop = 20;
  const padBottom = 35;

  const minRevenue = 20000;
  const maxRevenue = 70000;

  const pointsCoords = displayPoints.map((p, i) => {
    const x = padLeft + (i / (displayPoints.length - 1)) * (svgWidth - padLeft - padRight);
    const normalizedY = (p.revenue - minRevenue) / (maxRevenue - minRevenue);
    const y = svgHeight - padBottom - normalizedY * (svgHeight - padTop - padBottom);
    return { ...p, x, y };
  });

  // Construct smooth SVG path using Catmull-Rom or cubic Bezier
  const linePath = pointsCoords.reduce((acc, pt, i, arr) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = arr[i - 1];
    const cx = (prev.x + pt.x) / 2;
    return `${acc} C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`;
  }, '');

  const areaPath = `${linePath} L ${pointsCoords[pointsCoords.length - 1].x} ${svgHeight - padBottom} L ${pointsCoords[0].x} ${svgHeight - padBottom} Z`;

  // Grid levels for revenue
  const yTicks = [20000, 35000, 50000, 65000];

  return (
    <div className="space-y-6">
      {/* Visual Summary Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800/80">
              <BarChart3 className="w-4 h-4" />
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Visual Sales Analytics & Trends
            </h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Real-time performance summary for {vendorName || 'your store'} across Kathmandu Valley.
          </p>
        </div>

        {/* Timeframe Selector Pills */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setTimeframe('6m')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              timeframe === '6m'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Past 6 Months
          </button>
          <button
            onClick={() => setTimeframe('12m')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              timeframe === '12m'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Past 12 Months
          </button>
        </div>
      </div>

      {/* KPI Headline Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Sales */}
        <div className="bg-slate-900/90 rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Gross Sales
            </span>
            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/80">
              <ArrowUpRight className="w-3.5 h-3.5" />
              +{momGrowth.toFixed(1)}%
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tabular-nums tracking-tight">
            Rs. {totalPeriodRevenue.toLocaleString()}
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            Current month: <strong className="text-emerald-400">Rs. {latestMonth.revenue.toLocaleString()}</strong>
          </p>
        </div>

        {/* Total Orders */}
        <div className="bg-slate-900/90 rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Completed Orders
            </span>
            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/80">
              <ShoppingBag className="w-3.5 h-3.5" />
              +{latestMonth.growth}% MoM
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tabular-nums tracking-tight">
            {totalPeriodOrders.toLocaleString()}
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            10-15 min quick courier fulfillment
          </p>
        </div>

        {/* Average Order Value */}
        <div className="bg-slate-900/90 rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Avg Order Value
            </span>
            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/80">
              <TrendingUp className="w-3.5 h-3.5" />
              Healthy Basket
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tabular-nums tracking-tight">
            Rs. {avgOrderValue}
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            ~3.2 items per customer checkout
          </p>
        </div>

        {/* Store Quality & Dispatch Rating */}
        <div className="bg-slate-900/90 rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Dispatch Precision
            </span>
            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/80">
              ★ 4.9 Rating
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono tabular-nums tracking-tight">
            98.6%
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            Packaged under 5 mins on average
          </p>
        </div>
      </div>

      {/* Main Charts Row: Monthly Revenue Trend & Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Monthly Revenue Trend Area Chart (8 cols on lg) */}
        <div className="lg:col-span-8 bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  <span>Monthly Revenue Trend</span>
                </h3>
                <p className="text-sm text-slate-400">
                  Gross sales generated across all fulfilled quick-commerce orders.
                </p>
              </div>

              {/* Active point hover indicator */}
              <div className="text-right">
                <span className="text-xs text-slate-400 block">
                  {hoveredPoint ? hoveredPoint.month : latestMonth.month}
                </span>
                <span className="text-base font-extrabold text-emerald-400 font-mono tabular-nums">
                  Rs. {(hoveredPoint ? hoveredPoint.revenue : latestMonth.revenue).toLocaleString()}
                  <span className="text-xs text-slate-400 font-normal ml-1.5">
                    ({(hoveredPoint ? hoveredPoint.orders : latestMonth.orders)} orders)
                  </span>
                </span>
              </div>
            </div>

            {/* SVG Interactive Area Chart */}
            <div className="relative w-full overflow-hidden select-none">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-56 sm:h-64 overflow-visible"
              >
                <defs>
                  {/* Gradient for area fill */}
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                    <stop offset="70%" stopColor="#10b981" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.00" />
                  </linearGradient>

                  {/* Subtle vertical glow */}
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#10b981" floodOpacity="0.4" />
                  </filter>
                </defs>

                {/* Horizontal Gridlines & Y-Axis Labels */}
                {yTicks.map(val => {
                  const normalizedY = (val - minRevenue) / (maxRevenue - minRevenue);
                  const y = svgHeight - padBottom - normalizedY * (svgHeight - padTop - padBottom);
                  return (
                    <g key={val}>
                      <line
                        x1={padLeft}
                        y1={y}
                        x2={svgWidth - padRight}
                        y2={y}
                        stroke="#1e293b"
                        strokeDasharray="4 4"
                        strokeWidth="1"
                      />
                      <text
                        x={padLeft - 8}
                        y={y + 4}
                        fill="#94a3b8"
                        fontSize="12"
                        fontFamily="monospace"
                        textAnchor="end"
                      >
                        Rs. {val / 1000}k
                      </text>
                    </g>
                  );
                })}

                {/* Area Gradient Fill */}
                <path d={areaPath} fill="url(#revenueGradient)" />

                {/* Main Curve Line */}
                <path
                  d={linePath}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#glow)"
                />

                {/* X-Axis labels & Interactive Hover Hotspots */}
                {pointsCoords.map((pt, i) => {
                  const isHovered = hoveredPoint?.shortMonth === pt.shortMonth;
                  const isLatest = !hoveredPoint && i === pointsCoords.length - 1;
                  const isActive = isHovered || isLatest;

                  return (
                    <g
                      key={pt.shortMonth}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredPoint(pt)}
                      onMouseLeave={() => setHoveredPoint(null)}
                    >
                      {/* Vertical Guideline on Hover */}
                      {isActive && (
                        <line
                          x1={pt.x}
                          y1={padTop}
                          x2={pt.x}
                          y2={svgHeight - padBottom}
                          stroke="#34d399"
                          strokeWidth="1.5"
                          strokeDasharray="3 3"
                          opacity="0.8"
                        />
                      )}

                      {/* X-axis tick label */}
                      <text
                        x={pt.x}
                        y={svgHeight - 10}
                        fill={isActive ? '#34d399' : '#94a3b8'}
                        fontWeight={isActive ? 'bold' : 'normal'}
                        fontSize="13"
                        textAnchor="middle"
                        fontFamily="sans-serif"
                      >
                        {pt.shortMonth}
                      </text>

                      {/* Outer Ring */}
                      <circle
                        cx={pt.x}
                        y={pt.y}
                        r={isActive ? 7 : 4}
                        fill="#0f172a"
                        stroke="#10b981"
                        strokeWidth={isActive ? 3 : 2}
                        className="transition-all duration-150"
                      />

                      {/* Center Dot */}
                      {isActive && (
                        <circle
                          cx={pt.x}
                          y={pt.y}
                          r={3}
                          fill="#34d399"
                        />
                      )}

                      {/* Large Transparent Hitbox for effortless mobile/desktop hovering */}
                      <rect
                        x={pt.x - 20}
                        y={padTop}
                        width={40}
                        height={svgHeight - padTop}
                        fill="transparent"
                      />
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Bottom Chart Footer Strip */}
          <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span>Fulfilled Orders Revenue</span>
            </div>
            <span className="font-mono text-xs text-slate-500">
              Data aggregated in real-time from checkout transactions
            </span>
          </div>
        </div>

        {/* Category Share Distribution Donut Chart (4 cols on lg) */}
        <div className="lg:col-span-4 bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-emerald-400" />
                <span>Sales by Category</span>
              </h3>
              <span className="text-xs text-slate-400 font-mono">100% Share</span>
            </div>

            {/* Visual SVG Donut */}
            <div className="flex justify-center my-2">
              <div className="relative w-44 h-44">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  {/* Background Track */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke="#1e293b"
                    strokeWidth="12"
                  />
                  {/* Segments calculation */}
                  {(() => {
                    let cumulative = 0;
                    const circumference = 2 * Math.PI * 38; // ~238.76

                    return CATEGORY_BREAKDOWN.map(cat => {
                      const strokeDasharray = `${(cat.share / 100) * circumference} ${circumference}`;
                      const strokeDashoffset = -((cumulative / 100) * circumference);
                      cumulative += cat.share;
                      const isHovered = hoveredCategory?.name === cat.name;

                      return (
                        <circle
                          key={cat.name}
                          cx="50"
                          cy="50"
                          r="38"
                          fill="transparent"
                          stroke={cat.color}
                          strokeWidth={isHovered ? "15" : "12"}
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                          className="transition-all duration-200 cursor-pointer"
                          onMouseEnter={() => setHoveredCategory(cat)}
                          onMouseLeave={() => setHoveredCategory(null)}
                        />
                      );
                    });
                  })()}
                </svg>

                {/* Center Label in Donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                    {hoveredCategory ? hoveredCategory.name.split(' ')[0] : 'Total'}
                  </span>
                  <span className="text-lg font-extrabold text-white font-mono tabular-nums">
                    {hoveredCategory ? `${hoveredCategory.share}%` : `Rs. ${(259040 / 1000).toFixed(0)}k`}
                  </span>
                </div>
              </div>
            </div>

            {/* Category Breakdown Legend */}
            <div className="space-y-2 mt-4">
              {CATEGORY_BREAKDOWN.map(cat => {
                const isHovered = hoveredCategory?.name === cat.name;
                return (
                  <div
                    key={cat.name}
                    onMouseEnter={() => setHoveredCategory(cat)}
                    onMouseLeave={() => setHoveredCategory(null)}
                    className={`p-2.5 rounded-xl transition-all flex items-center justify-between gap-2 text-sm cursor-pointer ${
                      isHovered ? 'bg-slate-800' : 'hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-slate-300 font-medium truncate">
                        {cat.name}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-white font-mono tabular-nums mr-2">
                        {cat.share}%
                      </span>
                      <span className="text-xs text-slate-400 font-mono tabular-nums">
                        Rs. {(cat.revenue / 1000).toFixed(1)}k
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Top-Performing Products Horizontal Bar Chart & Peak Hours */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Top-Performing Products Ranked Chart (8 cols on lg) */}
        <div className="lg:col-span-8 bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                <span>Top-Performing Products</span>
              </h3>
              <p className="text-sm text-slate-400">
                Ranked by customer demand and gross sales contribution.
              </p>
            </div>
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-950 px-3 py-1 rounded-full border border-emerald-800">
              Highest Conversion
            </span>
          </div>

          <div className="space-y-4">
            {TOP_PRODUCTS_DATA.map((prod, idx) => {
              const isHovered = hoveredProduct?.id === prod.id;

              return (
                <div
                  key={prod.id}
                  onMouseEnter={() => setHoveredProduct(prod)}
                  onMouseLeave={() => setHoveredProduct(null)}
                  className={`p-3 sm:p-4 rounded-xl border transition-all ${
                    isHovered
                      ? 'bg-slate-800/90 border-emerald-500/60 shadow-md'
                      : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center shrink-0 font-mono">
                        #{idx + 1}
                      </span>
                      <img
                        src={prod.image}
                        alt={prod.name}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-lg object-cover bg-slate-800 shrink-0 border border-slate-700"
                      />
                      <div className="truncate">
                        <Link
                          to={`/product/${prod.id}`}
                          className="font-bold text-base text-white hover:text-emerald-400 transition-colors truncate block"
                        >
                          {prod.name}
                        </Link>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>{prod.category}</span>
                          <span>·</span>
                          <span className="font-mono">{prod.unit}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-extrabold text-white text-base font-mono tabular-nums">
                        Rs. {prod.revenue.toLocaleString()}
                      </div>
                      <div className="flex items-center justify-end gap-1 text-xs text-emerald-400 font-semibold">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>+{prod.growth}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Horizontal Bar Chart Gauge */}
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex-1 h-2.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                        style={{ width: `${prod.sharePercent * 3}%` }}
                      />
                    </div>
                    <div className="text-xs font-mono tabular-nums text-slate-400 shrink-0 w-32 text-right">
                      <strong className="text-slate-200">{prod.unitsSold}</strong> units sold
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Peak Delivery Hours Bar Chart (4 cols on lg) */}
        <div className="lg:col-span-4 bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-400" />
                <span>Peak Order Hours</span>
              </h3>
              <span className="text-xs text-slate-400 font-mono">24h Cycle</span>
            </div>
            <p className="text-sm text-slate-400 mb-5">
              Distribution of incoming 10-15 minute grocery dispatches throughout the day.
            </p>

            {/* Vertical Bar Chart */}
            <div className="h-48 flex items-end justify-between gap-1.5 pt-4 px-1 pb-2 border-b border-slate-800">
              {HOURLY_SALES.map((hr, idx) => {
                const maxOrders = 60;
                const heightPercent = (hr.orders / maxOrders) * 100;
                const isPeak = hr.orders >= 45;

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1 group cursor-pointer">
                    {/* Tooltip on hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-mono text-emerald-300 -translate-y-1">
                      {hr.orders}
                    </div>
                    {/* Bar */}
                    <div className="w-full bg-slate-800 rounded-t-md overflow-hidden h-32 flex items-end">
                      <div
                        className={`w-full rounded-t-md transition-all duration-300 ${
                          isPeak
                            ? 'bg-gradient-to-t from-emerald-600 to-teal-400 shadow-sm shadow-emerald-500/20'
                            : 'bg-slate-700 group-hover:bg-slate-600'
                        }`}
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>
                    {/* Hour label */}
                    <span className="text-xs text-slate-500 group-hover:text-slate-300 font-mono whitespace-nowrap mt-1">
                      {hr.hour.replace(' ', '')}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Morning vs Evening Insights */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-400">🌅 Morning Harvest Rush</span>
                <span className="font-bold text-white font-mono">8 AM - 10 AM</span>
              </div>
              <div className="flex items-center justify-between text-sm p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-400">🌆 Dinner & Kitchen Rush</span>
                <span className="font-bold text-emerald-400 font-mono">6 PM - 8 PM</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-500 text-center">
            Courier dispatch capacity adjusted automatically for peak hours
          </div>
        </div>

      </div>
    </div>
  );
}
