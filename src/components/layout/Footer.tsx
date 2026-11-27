import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Phone, Mail, Clock } from 'lucide-react';
import { useApp } from '../../context';
import { categoryService } from '../../services';
import { Category } from '../../types';
import { translateCategoryName } from '../../i18n';

export default function Footer() {
  const { setBecomeSellerModalOpen, publicSettings, t, language } = useApp();
  const [categories, setCategories] = useState<Category[]>([]);
  const supportInfo = publicSettings?.store_support;

  useEffect(() => {
    let isMounted = true;
    categoryService.getCategories()
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res?.results) ? res.results : (Array.isArray(res) ? res : []);
        setCategories(list);
      })
      .catch(() => {
        if (isMounted) setCategories([]);
      });

    const handleCategoriesUpdated = () => {
      categoryService.getCategories({ bypassCache: true })
        .then((res) => {
          if (!isMounted) return;
          const list = Array.isArray(res?.results) ? res.results : (Array.isArray(res) ? res : []);
          setCategories(list);
        })
        .catch(() => {});
    };

    window.addEventListener('categories:updated', handleCategoriesUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener('categories:updated', handleCategoriesUpdated);
    };
  }, []);

  const categoryList = Array.isArray(categories) ? categories : [];

  return (
    <footer className="w-full mt-auto border-t border-slate-200 dark:border-slate-800 bg-slate-900 dark:bg-[#060911] text-slate-300 dark:text-slate-400 pt-10 pb-24 md:pb-10 transition-colors duration-200">
      <div className="w-full px-4 sm:px-6 lg:px-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-extrabold text-base">
                O
              </div>
              <span className="font-extrabold text-xl text-white font-display">
                {supportInfo?.brandName || 'OyoPasal'}
              </span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              {supportInfo?.tagline || t('home.footerTagline')}
            </p>
          </div>

          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
              {t('home.footerCategories')}
            </h4>
            <ul className="space-y-2 text-sm">
              {categoryList.slice(0, 5).map((cat) => (
                <li key={cat.id}>
                  <Link to={`/category/${cat.slug}`} className="hover:text-emerald-400 transition-colors">
                    {translateCategoryName(cat.slug, cat.name, language)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
              {t('home.footerCustomerCare')}
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/account?tab=orders" className="hover:text-emerald-400 transition-colors">
                  {t('home.footerTrackOrders')}
                </Link>
              </li>
              <li>
                <Link to="/account?tab=addresses" className="hover:text-emerald-400 transition-colors">
                  {t('home.footerDeliveryLocs')}
                </Link>
              </li>
              <li>
                <a
                  href="tel:+9779818638565"
                  className="flex items-center gap-2 text-slate-300 hover:text-emerald-400 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Helpline: +977 9818638565</span>
                </a>
              </li>
              <li>
                <a
                  href="mailto:oyopasal@gmail.com"
                  className="flex items-center gap-2 text-slate-300 hover:text-emerald-400 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Helpdesk: oyopasal@gmail.com</span>
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
              {t('home.footerZones')}
            </h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              {supportInfo?.address || t('home.footerZonesDesc')}
            </p>
            <div className="mt-3 flex items-center gap-2 text-sm text-emerald-400 font-bold">
              <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{supportInfo?.hours || t('home.footerHours')}</span>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <span>{t('home.footerRights')}</span>
          <div className="flex items-center gap-4">
            <Link to="/privacy-policy" className="hover:text-emerald-400 transition-colors">
              {t('home.footerPrivacy')}
            </Link>
            <span>·</span>
            <Link to="/vendor/privacy-policy" className="hover:text-emerald-400 transition-colors">
              Vendor Privacy
            </Link>
            <span>·</span>
            <span>{t('home.footerTerms')}</span>
            <span>·</span>
            <button
              onClick={() => setBecomeSellerModalOpen(true)}
              className="hover:text-emerald-400 font-semibold cursor-pointer transition-colors"
            >
              {t('home.footerSellerPortal')}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
