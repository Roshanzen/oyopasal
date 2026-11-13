import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  ShoppingBag,
  Award,
  BarChart3,
  PieChart as PieChartIcon,
  Loader2,
  Package,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../shared/context/AppContext';
import { api } from '../../shared/services/api';
import { translateCategoryName } from '../../shared/i18n/translations';
import { SellerAnalyticsResponse } from '../../shared/types';

const CATEGORY_COLORS = ['#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899'];

export default function SellerVisualSummary({
  vendorId,
  vendorName,
}: {
  vendorId?: string;
  vendorName?: string;
}) {
  const { t, formatPrice, language } = useApp();
  const [timeframe, setTimeframe] = useState<'6m' | '12m'>('6m');
  const [analytics, setAnalytics] = useState<SellerAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [retrySeq, setRetrySeq] = useState(0);
  const [hoveredMonthIdx, setHoveredMonthIdx] = useState<number | null>(null);
  const [hoveredCategoryIdx, setHoveredCategoryIdx] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    async function loadAnalytics() {
      try {
        setLoading(true);
        setError(null);
        const months = timeframe === '12m' ? 12 : 6;
        const data = await api.getSellerAnalytics(vendorId, months);
        if (active) setAnalytics(data);
      } catch (err) {
        console.error('Failed to load seller analytics:', err);
        if (active) setError(err instanceof Error ? err.message : 'Unable to load sales analytics');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadAnalytics();
    return () => {
      active = false;
    };
  }, [vendorId, timeframe, retrySeq]);

  if (loading && !analytics) {
    return (
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-10 text-center">
        <Loader2 className="w-7 h-7 animate-spin text-emerald-500 mx-auto mb-2" />
        <p className="text-sm text-slate-400">Aggregating real PostgreSQL sales analytics...</p>
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <div className="bg-rose-950/40 rounded-2xl border border-rose-800/80 p-8 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
        <p className="text-sm font-bold text-rose-200">{error}</p>
        <button
          type="button"
          onClick={() => setRetrySeq((s) => s + 1)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Analytics</span>
        </button>
      </div>
    );
  }

  const monthlyTrend = analytics?.monthly_trend || [];
  const topProducts = analytics?.top_products || [];
  const categoryBreakdown = analytics?.category_breakdown || [];
  const totalRevenue = analytics?.summary.total_revenue || 0;
  const totalOrders = analytics?.summary.total_orders || 0;
  const avgOrderValue = analytics?.summary.avg_order_value || 0;

  const latestPoint = monthlyTrend[monthlyTrend.length - 1];
  const priorPoint = monthlyTrend[monthlyTrend.length - 2];
  const momGrowth =
    priorPoint && priorPoint.revenue > 0
      ? ((latestPoint.revenue - priorPoint.revenue) / priorPoint.revenue) * 100
      : 0;

  // SVG Area Chart math (safe for 0, 1, or N points)
  const svgWidth = 680;
  const svgHeight = 220;
  const padLeft = 58;
  const padRight = 25;
  const padTop = 20;
  const padBottom = 35;

  const maxRev = Math.max(1000, ...monthlyTrend.map((m) => m.revenue));
  const yTicks = [0, Math.round(maxRev * 0.33), Math.round(maxRev * 0.66), maxRev];

  const pointsCoords = monthlyTrend.map((p, i) => {
    const denom = Math.max(1, monthlyTrend.length - 1);
    const x =
      monthlyTrend.length === 1
        ? (svgWidth + padLeft - padRight) / 2
        : padLeft + (i / denom) * (svgWidth - padLeft - padRight);
    const normalizedY = p.revenue / maxRev;
    const y = svgHeight - padBottom - normalizedY * (svgHeight - padTop - padBottom);
    return { ...p, x, y };
  });

  const linePath =
    pointsCoords.length >= 2
      ? pointsCoords.reduce((acc, pt, i, arr) => {
          if (i === 0) return `M ${pt.x} ${pt.y}`;
          const prev = arr[i - 1];
          const cx = (prev.x + pt.x) / 2;
          return `${acc} C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`;
        }, '')
      : '';

  const areaPath =
    pointsCoords.length >= 2
      ? `${linePath} L ${pointsCoords[pointsCoords.length - 1].x} ${svgHeight - padBottom} L ${pointsCoords[0].x} ${svgHeight - padBottom} Z`
      : '';

  const totalCatRevenue = categoryBreakdown.reduce((s, c) => s + c.revenue, 0);
  const categoriesWithShare = categoryBreakdown.map((c, idx) => ({
    ...c,
    color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
    share: totalCatRevenue > 0 ? Math.round((c.revenue / totalCatRevenue) * 100) : 0,
  }));

  const maxProductRev = Math.max(1, ...topProducts.map((p) => p.revenue));
  const activePoint =
    hoveredMonthIdx !== null ? monthlyTrend[hoveredMonthIdx] : latestPoint || null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800/80">
              <BarChart3 className="w-4 h-4" />
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">{t('charts.title')}</h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {t('charts.subtitle', {
              name: vendorName || (language === 'ne' ? 'तपाईंको पसल' : 'your store'),
            })}
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setTimeframe('6m')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              timeframe === '6m' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t('charts.past6m')}
          </button>
          <button
            onClick={() => setTimeframe('12m')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              timeframe === '12m' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t('charts.past12m')}
          </button>
        </div>
      </div>

      {/* Live PostgreSQL KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t('charts.totalGrossSales')}
            </span>
            {priorPoint && (
              <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/80">
                {momGrowth >= 0 ? '+' : ''}
                {momGrowth.toFixed(1)}%
              </span>
            )}
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tabular-nums">
            {formatPrice(totalRevenue.toLocaleString())}
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            {latestPoint
              ? `${latestPoint.month}: ${formatPrice(latestPoint.revenue.toLocaleString())}`
              : 'Live PostgreSQL fulfillment ledger'}
          </p>
        </div>

        <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t('charts.completedOrders')}
            </span>
            <ShoppingBag className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tabular-nums">
            {totalOrders.toLocaleString()}
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            Non-cancelled fulfillments in selected period
          </p>
        </div>

        <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t('charts.avgOrderValue')}
            </span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tabular-nums">
            {formatPrice(avgOrderValue)}
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            Calculated directly from vendor fulfillments
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Monthly Revenue Trend */}
        <div className="lg:col-span-8 bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  <span>{t('charts.monthlyTrendTitle')}</span>
                </h3>
                <p className="text-sm text-slate-400">{t('charts.monthlyTrendSub')}</p>
              </div>
              {activePoint && (
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">{activePoint.month}</span>
                  <span className="text-base font-extrabold text-emerald-400 font-mono tabular-nums">
                    {formatPrice(activePoint.revenue.toLocaleString())}
                    <span className="text-xs text-slate-400 font-normal ml-1.5">
                      ({activePoint.orders} orders)
                    </span>
                  </span>
                </div>
              )}
            </div>

            {monthlyTrend.length === 0 ? (
              <div className="h-56 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl text-slate-500 text-sm">
                <Package className="w-8 h-8 mb-2 opacity-60" />
                <span>No completed orders in this timeframe yet. Place an order to populate trends.</span>
              </div>
            ) : (
              <div className="relative w-full overflow-hidden select-none">
                <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-56 sm:h-64 overflow-visible">
                  <defs>
                    <linearGradient id="revenueGradientLive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.00" />
                    </linearGradient>
                  </defs>

                  {yTicks.map((val) => {
                    const y = svgHeight - padBottom - (val / maxRev) * (svgHeight - padTop - padBottom);
                    return (
                      <g key={val}>
                        <line
                          x1={padLeft}
                          y1={y}
                          x2={svgWidth - padRight}
                          y2={y}
                          stroke="#1e293b"
                          strokeDasharray="4 4"
                        />
                        <text
                          x={padLeft - 8}
                          y={y + 4}
                          fill="#94a3b8"
                          fontSize="11"
                          fontFamily="monospace"
                          textAnchor="end"
                        >
                          {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                        </text>
                      </g>
                    );
                  })}

                  {areaPath && <path d={areaPath} fill="url(#revenueGradientLive)" />}
                  {linePath && (
                    <path
                      d={linePath}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  )}

                  {pointsCoords.map((pt, i) => {
                    const isActive =
                      hoveredMonthIdx === i || (hoveredMonthIdx === null && i === pointsCoords.length - 1);
                    return (
                      <g
                        key={`${pt.month}-${i}`}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredMonthIdx(i)}
                        onMouseLeave={() => setHoveredMonthIdx(null)}
                      >
                        <text
                          x={pt.x}
                          y={svgHeight - 10}
                          fill={isActive ? '#34d399' : '#94a3b8'}
                          fontWeight={isActive ? 'bold' : 'normal'}
                          fontSize="12"
                          textAnchor="middle"
                        >
                          {pt.month}
                        </text>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isActive ? 7 : 5}
                          fill="#0f172a"
                          stroke="#10b981"
                          strokeWidth={isActive ? 3 : 2}
                        />
                        <rect
                          x={pt.x - 24}
                          y={padTop}
                          width={48}
                          height={svgHeight - padTop}
                          fill="transparent"
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>PostgreSQL live order aggregation</span>
            <span className="font-mono text-slate-500">Vendor isolated ledger</span>
          </div>
        </div>

        {/* Category Breakdown Donut */}
        <div className="lg:col-span-4 bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-emerald-400" />
                <span>{t('charts.salesByCatTitle')}</span>
              </h3>
            </div>

            {categoriesWithShare.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-500">
                No category sales recorded yet.
              </div>
            ) : (
              <>
                <div className="flex justify-center my-2">
                  <div className="relative w-44 h-44">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r="38" fill="transparent" stroke="#1e293b" strokeWidth="12" />
                      {(() => {
                        let cumulative = 0;
                        const circumference = 2 * Math.PI * 38;
                        return categoriesWithShare.map((cat, idx) => {
                          const strokeDasharray = `${(cat.share / 100) * circumference} ${circumference}`;
                          const strokeDashoffset = -((cumulative / 100) * circumference);
                          cumulative += cat.share;
                          return (
                            <circle
                              key={cat.category}
                              cx="50"
                              cy="50"
                              r="38"
                              fill="transparent"
                              stroke={cat.color}
                              strokeWidth={hoveredCategoryIdx === idx ? '15' : '12'}
                              strokeDasharray={strokeDasharray}
                              strokeDashoffset={strokeDashoffset}
                              className="transition-all duration-200 cursor-pointer"
                              onMouseEnter={() => setHoveredCategoryIdx(idx)}
                              onMouseLeave={() => setHoveredCategoryIdx(null)}
                            />
                          );
                        });
                      })()}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                      <span className="text-xs text-slate-400 font-semibold">
                        {hoveredCategoryIdx !== null
                          ? categoriesWithShare[hoveredCategoryIdx].category.split(' ')[0]
                          : language === 'ne'
                          ? 'जम्मा'
                          : 'Total'}
                      </span>
                      <span className="text-lg font-extrabold text-white font-mono tabular-nums">
                        {hoveredCategoryIdx !== null
                          ? `${categoriesWithShare[hoveredCategoryIdx].share}%`
                          : formatPrice(totalCatRevenue.toLocaleString())}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mt-4">
                  {categoriesWithShare.map((cat, idx) => (
                    <div
                      key={cat.category}
                      onMouseEnter={() => setHoveredCategoryIdx(idx)}
                      onMouseLeave={() => setHoveredCategoryIdx(null)}
                      className="p-2 rounded-xl hover:bg-slate-800/70 transition-all flex items-center justify-between gap-2 text-sm cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-slate-300 font-medium truncate">
                          {translateCategoryName(cat.category, cat.category, language)}
                        </span>
                      </div>
                      <div className="text-right shrink-0 font-mono text-xs">
                        <span className="font-bold text-white mr-2">{cat.share}%</span>
                        <span className="text-slate-400">{formatPrice(cat.revenue.toLocaleString())}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Top Performing Products */}
      <div className="bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              <span>{t('charts.topProductsTitle')}</span>
            </h3>
            <p className="text-sm text-slate-400">{t('charts.topProductsSub')}</p>
          </div>
        </div>

        {topProducts.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500 border border-dashed border-slate-800 rounded-xl">
            No product sales recorded yet for this vendor.
          </div>
        ) : (
          <div className="space-y-3">
            {topProducts.map((prod, idx) => {
              const barPct = Math.max(8, Math.round((prod.revenue / maxProductRev) * 100));
              return (
                <div
                  key={`${prod.name}-${idx}`}
                  className="p-4 rounded-xl border border-slate-800/80 bg-slate-950/70"
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center shrink-0 font-mono">
                        #{idx + 1}
                      </span>
                      <span className="font-bold text-base text-white truncate">{prod.name}</span>
                    </div>
                    <div className="font-extrabold text-white text-base font-mono tabular-nums shrink-0">
                      {formatPrice(prod.revenue.toLocaleString())}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                    <div className="text-xs font-mono text-slate-400 shrink-0 w-28 text-right">
                      <strong className="text-slate-200">{prod.units}</strong> {t('charts.unitsSold')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
