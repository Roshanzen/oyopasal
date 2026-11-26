import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  MapPin,
  Phone,
  Mail,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

interface PolicySection {
  id: string;
  number: number;
  title: string;
  content: React.ReactNode;
}

export default function CustomerPrivacyPolicyPage() {
  useEffect(() => {
    document.title = 'Privacy Policy – OyoPasal';
    window.scrollTo(0, 0);
  }, []);

  const sections: PolicySection[] = [
    {
      id: 'section-1',
      number: 1,
      title: 'Overview & Privacy Guarantee',
      content: (
        <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
          <p>
            Welcome to <strong>OyoPasal</strong>, operated by <strong>OyoPasal Marketplace Pvt. Ltd.</strong> in Kathmandu, Nepal. We provide a hyper-local multi-vendor e-commerce platform connecting neighborhood customers with local grocery stores, bakeries, and fresh produce vendors across the Kathmandu Valley and Nepal.
          </p>
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-sm space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-[#059669] dark:text-emerald-400 shrink-0" />
              <span>Core Privacy Guarantee</span>
            </div>
            <p className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-200">
              We collect customer data solely to coordinate and deliver neighborhood orders quickly and safely. We <strong>never sell, rent, or trade personal data</strong> to third-party ad networks or data brokers under the <strong>Nepal Individual Privacy Act, 2075</strong>.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'section-2',
      number: 2,
      title: 'Information We Collect',
      content: (
        <div className="space-y-3 text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
          <p>
            To deliver your groceries within 10–15 minutes, we collect only essential information:
          </p>
          <ul className="space-y-2.5 text-xs sm:text-sm pl-1">
            <li className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-2 shrink-0" />
              <span><strong>Account Details:</strong> Full name, verified mobile phone number, email address, and encrypted login credentials.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-2 shrink-0" />
              <span><strong>Delivery Location:</strong> Pinned GPS coordinates, delivery address (Tole, Ward, Municipality), and landmark notes used solely by riders to locate your doorstep.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-2 shrink-0" />
              <span><strong>Order & Chat History:</strong> Purchased items, store receipts, dispatch status logs, and direct customer-to-vendor chat messages.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-2 shrink-0" />
              <span><strong>Essential Cookies & Auth Tokens:</strong> Secure local storage session tokens (<code className="font-mono text-emerald-600 dark:text-emerald-400 text-xs">oyopasal_customer_auth</code>) used strictly to keep your shopping cart and authenticated session active.</span>
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: 'section-3',
      number: 3,
      title: 'How We Use & Share Information',
      content: (
        <div className="space-y-3 text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
          <p>
            Customer details are processed exclusively for order dispatch, rider navigation, order status notifications, and customer support.
          </p>
          <p>
            When you place an order, ordered items and delivery contact details are shared strictly with the <strong>specific Partner Store</strong> packing your sub-order and the <strong>assigned Delivery Rider</strong> delivering it. In multi-vendor checkouts, each merchant sees only their own line items. We never share customer data with cross-merchant marketing lists, B2B brokers, or advertising networks.
          </p>
        </div>
      ),
    },
    {
      id: 'section-4',
      number: 4,
      title: 'Payments & Data Security',
      content: (
        <div className="space-y-3 text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
          <p>
            OyoPasal operates primarily on <strong>Cash on Delivery (COD)</strong> and <strong>Store Pickup</strong>, along with secure digital settlements. OyoPasal <strong>never collects, processes, or stores credit/debit card numbers, CVVs, or digital wallet MPINs</strong> on our servers.
          </p>
          <p>
            All network communication is protected via TLS 1.3/HTTPS encryption in transit. Passwords are cryptographic salted hashes (PBKDF2), user sessions use signed RSA-256 JWT tokens, and database access is locked down with strict role isolation.
          </p>
        </div>
      ),
    },
    {
      id: 'section-5',
      number: 5,
      title: 'Data Retention & Your Rights',
      content: (
        <div className="space-y-3 text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
          <p>
            You maintain full control of your personal information. You can edit your name, phone number, and saved delivery addresses anytime directly within <Link to="/account" className="text-emerald-600 dark:text-emerald-400 font-semibold underline">My Account</Link>.
          </p>
          <p>
            You may request complete account deletion or a copy of your stored data at any time by emailing <a href="mailto:privacy@oyopasal.com" className="text-emerald-600 dark:text-emerald-400 font-semibold underline">privacy@oyopasal.com</a>. Completed order receipts and tax invoices are retained only for the minimum period legally required under the Nepal Income Tax Act, 2058.
          </p>
        </div>
      ),
    },
    {
      id: 'section-6',
      number: 6,
      title: 'Contact Us',
      content: (
        <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
          <p>
            If you have questions regarding this Privacy Policy or wish to exercise your statutory rights under Nepalese law, our Privacy & Grievance team is ready to assist:
          </p>
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs sm:text-sm">
            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Email: <a href="mailto:privacy@oyopasal.com" className="text-emerald-600 dark:text-emerald-400 font-bold underline">privacy@oyopasal.com</a></span>
            </div>
            <div className="flex items-center gap-2.5">
              <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Helpline: <span className="font-semibold">+977 01-5970000</span></span>
            </div>
            <div className="flex items-start gap-2.5 sm:col-span-2">
              <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>Address: OyoPasal Marketplace Pvt. Ltd., Pulchowk, Lalitpur, Kathmandu Valley, Nepal</span>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white transition-colors duration-200 pb-16">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-b from-emerald-950 via-[#1B4332] to-[#123324] text-white pt-10 pb-12 px-4 sm:px-6 lg:px-8 border-b border-emerald-900 shadow-md">
        <div className="max-w-5xl mx-auto space-y-4">
          {/* Breadcrumb & Audience Link */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-2 text-emerald-200/80">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-white font-semibold">Privacy Policy</span>
            </div>

            <Link
              to="/vendor/privacy-policy"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/30 border border-white/10 text-xs font-semibold text-emerald-200 hover:text-white transition-colors backdrop-blur-xs"
            >
              <span>Switch to Vendor Policy</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          {/* Clean Title & Subtitle */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white font-display">
              Privacy Policy
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
              Last updated: November 2026 • Effective for OyoPasal Customers & Partner Stores in Nepal
            </p>
          </div>
        </div>
      </div>

      {/* 2. Main Full-Width Single-Column Content Container */}
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="w-full bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-10 space-y-8">
          {sections.map((sec, index) => (
            <section
              key={sec.id}
              id={sec.id}
              className={`space-y-4 ${
                index < sections.length - 1
                  ? 'pb-8 border-b border-slate-100 dark:border-slate-800/80'
                  : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
                  {sec.number}
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  {sec.title}
                </h2>
              </div>

              <div>{sec.content}</div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
