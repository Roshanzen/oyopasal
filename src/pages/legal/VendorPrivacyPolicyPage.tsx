import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  Lock,
  Store,
  FileText,
  UserCheck,
  CreditCard,
  Building2,
  DollarSign,
  AlertTriangle,
  Server,
  Bell,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  Mail,
  MapPin,
  Phone,
  CheckCircle2,
  Printer,
  Share2,
  Clock,
  ArrowRight,
  Layers,
  Check,
  Scale,
  Briefcase,
  Users,
} from 'lucide-react';

interface VendorPolicySection {
  id: string;
  letter: string;
  title: string;
  summary: string;
  icon: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
}

export default function VendorPrivacyPolicyPage() {
  const [activeSection, setActiveSection] = useState<string>('intro');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  useEffect(() => {
    document.title = 'Vendor Privacy Policy – OyoPasal Merchant Portal';
    window.scrollTo(0, 0);
  }, []);

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const sections = document.querySelectorAll('section[id]');
      const scrollY = window.pageYOffset;
      sections.forEach((current) => {
        const sectionHeight = (current as HTMLElement).offsetHeight;
        const sectionTop = (current as HTMLElement).offsetTop - 140;
        const sectionId = current.getAttribute('id') || '';
        if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
          setActiveSection(sectionId);
        }
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const sections: VendorPolicySection[] = [
    {
      id: 'introduction',
      letter: 'A',
      title: 'Introduction & Multi-Vendor Marketplace Model',
      summary: 'Platform partnership model, relationship between OyoPasal and registered vendors, and privacy scope.',
      icon: Store,
      content: (
        <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
          <p>
            This <strong>Vendor Privacy Policy</strong> governs the collection, processing, security, and governance of business, financial, verification, and personnel data relating to merchant partners, store owners, applicants, and authorized vendor staff on <strong>OyoPasal</strong>.
          </p>
          <p>
            OyoPasal operates as a hyper-local multi-vendor electronic marketplace in Nepal. Registered vendors operate independent digital storefronts to list products, receive localized customer orders, and manage dispatch fulfillment.
          </p>
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-sm space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
              <Building2 className="w-4 h-4 text-amber-600 shrink-0" />
              <span>B2B Commercial Partnership & Compliance</span>
            </div>
            <p>
              By applying for vendor onboarding or operating a merchant account on OyoPasal, you enter into a commercial platform agreement governed by the <strong>Electronic Transactions Act, 2063 (2006)</strong>, the <strong>Individual Privacy Act, 2075</strong>, and applicable tax directives of the Government of Nepal.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'vendor-information-we-collect',
      letter: 'B',
      title: 'Vendor Information We Collect',
      summary: 'Business identity, KYC documents, PAN/VAT certificates, owner records, and settlement details.',
      icon: Briefcase,
      content: (
        <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
          <p>
            To onboard, verify, and operate legitimate merchant businesses on our marketplace, we collect the following categories of information:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <Store className="w-4 h-4 text-emerald-600" />
                1. Storefront & Business Profile
              </h4>
              <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 dark:text-slate-400">
                <li>Registered Business Name and Public Store Name</li>
                <li>Store Slug identifier (e.g. rahul-pasal)</li>
                <li>Business Category (Groceries, Bakery, Fresh Produce, etc.)</li>
                <li>Physical Store Address (Tole, Ward, Municipality, District)</li>
                <li>GPS Geographical Coordinates and Express Delivery Radius (km)</li>
                <li>Store description, public contact email, and telephone number</li>
                <li>Visual Branding: Store logo, cover banner, gallery images</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                2. Owner & Authorized Representatives
              </h4>
              <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 dark:text-slate-400">
                <li>Proprietor / Managing Director full legal name</li>
                <li>Mobile contact number and verified merchant login email</li>
                <li>Dedicated merchant account credentials (isolated in <code className="font-mono text-emerald-600">oyopasal_vendor_auth</code>)</li>
                <li>Vendor Staff member profiles and granular permissions (<code className="font-mono text-xs">can_manage_products</code>, <code className="font-mono text-xs">can_manage_orders</code>)</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                3. Business Verification & KYC Compliance
              </h4>
              <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 dark:text-slate-400">
                <li>Permanent Account Number (PAN) or Value Added Tax (VAT) Certificate</li>
                <li>Company Registration Document (Office of Company Registrar or Ward Business Permit)</li>
                <li>Citizenship Certificate (Nagrikta) of the authorized business owner</li>
                <li>Verification audit timestamps and platform approval status (<code className="font-mono text-xs">APPROVED</code>, <code className="font-mono text-xs">PENDING</code>)</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                4. Bank Settlement & Payout Details
              </h4>
              <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 dark:text-slate-400">
                <li>Bank Name in Nepal (Commercial 'A' Class Bank or Licensed Institution)</li>
                <li>Bank Branch Location</li>
                <li>Bank Account Title (must strictly match registered business or owner name)</li>
                <li>Bank Account Number (encrypted at rest; masked in portal views)</li>
                <li>Cancelled cheque image for payout account verification</li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'vendor-account-activity',
      letter: 'C',
      title: 'Vendor Account & Store Operations Activity',
      summary: 'Monitoring logins, dashboard usage, catalog edits, and order dispatch lifecycle actions.',
      icon: Layers,
      content: (
        <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
          <p>
            When merchants access the <strong>Vendor Dashboard</strong> (<code className="text-emerald-600 font-mono">/seller</code>), our backend systems log operational telemetry for platform security, audit accountability, and fulfillment dispute resolution:
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            <li><strong>Authentication Telemetry:</strong> Login attempts, merchant session durations, IP addresses, and user-agent strings.</li>
            <li><strong>Inventory Audit Trail:</strong> Timestamped additions of products, unit price updates, stock replenishment records, and low-stock threshold alterations.</li>
            <li><strong>Order Fulfillment Progression:</strong> Exact timestamps when a vendor moves a sub-order from <code className="font-mono text-emerald-600">CONFIRMED_BY_VENDOR</code> to <code className="font-mono text-emerald-600">PACKED_BY_VENDOR</code> or requests rider pickup.</li>
            <li><strong>Internal Support & Chat Logs:</strong> Inquiries between vendor staff and customer concierge or admin support desks.</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'product-inventory-info',
      letter: 'D',
      title: 'Product, Inventory & Public Marketplace Display',
      summary: 'Processing product metadata and clarifying what is displayed publicly on the customer storefront.',
      icon: FileText,
      content: (
        <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
          <p>
            When you list items in the <strong>Catalog & Inventory Tab</strong>, OyoPasal processes product metadata for indexing, search discovery, and public storefront display:
          </p>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 text-xs sm:text-sm">
            <h4 className="font-bold text-slate-900 dark:text-white">Publicly Displayed Product Attributes:</h4>
            <p className="text-slate-600 dark:text-slate-400">
              Product titles, high-resolution imagery, descriptions, selling prices, regular prices, active discount badges, variant attributes (size, weight, packaging), in-stock availability indicators, and verified customer reviews.
            </p>
            <p className="text-slate-600 dark:text-slate-400 pt-1">
              Internal parameters such as warehouse reservation IDs, vendor wholesale cost, low-stock warning thresholds, and supplier details remain strictly confidential and are never visible to customers.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'vendor-order-customer-info',
      letter: 'E',
      title: 'Vendor Order & Customer Information (Strict Custodian Duties)',
      summary: 'Rules governing customer data accessed by merchants during order packaging and fulfillment.',
      icon: Users,
      content: (
        <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
          <p>
            When a customer purchases items from your store, OyoPasal grants temporary, role-restricted access to specific customer details solely to facilitate packaging and dispatch:
          </p>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white text-sm">Permitted Customer Information Visible to Vendor:</h4>
            <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 dark:text-slate-400">
              <li>Recipient delivery name.</li>
              <li>Delivery destination address, tole, and area for packaging manifests.</li>
              <li>Customer contact phone number (provided strictly for fulfillment coordination, substitution queries, or rider handover).</li>
              <li>Customer delivery notes (e.g. &quot;pack vegetables separately from detergent&quot;).</li>
              <li>Items, variants, and quantities ordered from your specific store.</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs sm:text-sm space-y-2">
            <div className="flex items-center gap-2 font-bold text-rose-800 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Strict Legal Custodian Prohibitions for Vendors</span>
            </div>
            <p>
              Vendors are legally bound as data custodians under the <strong>Individual Privacy Act, 2075</strong> and marketplace vendor agreements. You must NEVER:
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Export, compile, or store customer phone numbers into independent customer databases.</li>
              <li>Send unsolicited external marketing messages, SMS offers, WhatsApp blasts, or promotional calls to customers.</li>
              <li>Sell, exchange, or share customer contact records with external entities.</li>
              <li>Attempt to access other vendors&apos; order records, pricing, or customer lists.</li>
            </ul>
            <p className="font-semibold pt-1">
              Any misuse of customer information results in immediate account de-activation, civil damages claims, forfeiture of pending settlements, and referral to Nepal legal authorities.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'financial-commissions',
      letter: 'F',
      title: 'Sales, Commission & Financial Calculations',
      summary: 'Transparent processing of sub-orders, category commission deductions, delivery fees, and net payouts.',
      icon: DollarSign,
      content: (
        <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
          <p>
            OyoPasal maintains an immutable financial transaction ledger for every vendor sub-order. Our platform calculates settlements according to agreed marketplace terms:
          </p>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="font-bold text-slate-900 dark:text-white text-sm">Settlement Formula:</h4>
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 font-mono text-xs sm:text-sm text-emerald-900 dark:text-emerald-300">
              Net Vendor Payout = Store Subtotal - (Platform Commission %) + Attributable Delivery Allocation - Refund Adjustments
            </div>
            <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
              <li><strong>Store Subtotal:</strong> Total value of your store&apos;s products ordered by the customer.</li>
              <li><strong>Platform Commission:</strong> Category-based percentage or custom override rate agreed during onboarding.</li>
              <li><strong>Financial Ledger:</strong> All pending, credited, and settled balances are visible in your real-time <strong>Inventory Ledger Tab</strong>.</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 'vendor-payouts-banking',
      letter: 'G',
      title: 'Vendor Payout & Banking Information',
      summary: 'Bank details handling, encryption safeguards, and access controls restricting staff visibility.',
      icon: CreditCard,
      content: (
        <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
          <p>
            To transfer sales payouts directly to your business bank account, OyoPasal securely processes your banking details:
          </p>
          <ul className="list-disc list-inside space-y-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
            <li><strong>Restricted Owner Visibility:</strong> Bank account numbers and settlement statements are accessible ONLY to verified Vendor Owners. General staff sub-accounts (<code className="font-mono text-xs">VendorStaffMember</code>) are strictly blocked from viewing banking and financial records.</li>
            <li><strong>Encryption at Rest:</strong> Bank details are stored encrypted in our database and displayed masked (e.g. <code className="font-mono">XXXX-XXXX-1234</code>) in the settings interface.</li>
            <li><strong>Automated Electronic Clearing:</strong> Payouts are executed via approved banking payment systems in Nepal (connectIPS / NCHL / direct interbank transfer).</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'store-visibility-public-data',
      letter: 'H',
      title: 'Store Visibility vs Confidential Business Data',
      summary: 'Clear classification separating publicly visible storefront information from confidential merchant data.',
      icon: Eye,
      content: (
        <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
          <p>
            To avoid ambiguity, we maintain a strict boundary between public marketing details and confidential business records:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold">
                <tr>
                  <th className="p-2.5 sm:p-3">Public Storefront Information</th>
                  <th className="p-2.5 sm:p-3">Confidential Merchant Information</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
                <tr>
                  <td className="p-2.5 sm:p-3">✓ Store Name & Description</td>
                  <td className="p-2.5 sm:p-3 text-rose-600 dark:text-rose-400 font-semibold">✗ PAN/VAT Registration Numbers</td>
                </tr>
                <tr>
                  <td className="p-2.5 sm:p-3">✓ Store Logo, Banner & Gallery Images</td>
                  <td className="p-2.5 sm:p-3 text-rose-600 dark:text-rose-400 font-semibold">✗ Bank Account & Cheque Images</td>
                </tr>
                <tr>
                  <td className="p-2.5 sm:p-3">✓ Physical Store Area & Operating Hours</td>
                  <td className="p-2.5 sm:p-3 text-rose-600 dark:text-rose-400 font-semibold">✗ Owner Citizenship (Nagrikta) Documents</td>
                </tr>
                <tr>
                  <td className="p-2.5 sm:p-3">✓ Approved Product Catalog & Pricing</td>
                  <td className="p-2.5 sm:p-3 text-rose-600 dark:text-rose-400 font-semibold">✗ Platform Commission Agreements</td>
                </tr>
                <tr>
                  <td className="p-2.5 sm:p-3">✓ Customer Ratings & Store Reviews</td>
                  <td className="p-2.5 sm:p-3 text-rose-600 dark:text-rose-400 font-semibold">✗ Net Sales Revenue & Ledger Balances</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ),
    },
    {
      id: 'vendor-notifications',
      letter: 'I',
      title: 'Vendor Notifications & Operational Alerts',
      summary: 'Automated order dispatch emails, low stock warnings, payout confirmations, and policy notices.',
      icon: Bell,
      content: (
        <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
          <p>
            OyoPasal automatically transmits operational notifications to ensure prompt order processing:
          </p>
          <ul className="list-disc list-inside space-y-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
            <li><strong>New Customer Order Alerts:</strong> Dispatched immediately via automated email to your registered store contact email with line items, quantities, and direct dashboard deep links (<code className="font-mono text-emerald-600">/seller?tab=orders&order_id=...</code>).</li>
            <li><strong>Cancellation & Return Alerts:</strong> Real-time notifications when a customer cancels an unfulfilled order.</li>
            <li><strong>Financial Payout Confirmations:</strong> Settlement batch advisories detailing credited net payout totals.</li>
            <li><strong>Low-Stock & Inventory Warnings:</strong> Automated alerts when product quantities drop below specified thresholds.</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'vendor-data-security',
      letter: 'J',
      title: 'Vendor Data Security & Access Controls',
      summary: 'Separated merchant authentication, JWT isolation, API permissions, and multi-factor protections.',
      icon: Lock,
      content: (
        <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
          <p>
            Vendor accounts are safeguarded by enterprise-grade access control architecture:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <strong className="text-slate-900 dark:text-white block font-bold">Session & Storage Isolation</strong>
              <span className="text-slate-600 dark:text-slate-400">
                Vendor credentials use isolated storage keys (<code className="font-mono text-emerald-600">oyopasal_vendor_auth</code>) distinct from customer shopping accounts, preventing session crossover.
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <strong className="text-slate-900 dark:text-white block font-bold">API-Level Vendor Segregation</strong>
              <span className="text-slate-600 dark:text-slate-400">
                Backend permission classes (<code className="font-mono text-emerald-600">IsVendorOrAdmin</code>) enforce that a vendor can only query and mutate their own store records.
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <strong className="text-slate-900 dark:text-white block font-bold">Salted Cryptographic Hashing</strong>
              <span className="text-slate-600 dark:text-slate-400">
                Vendor passwords are cryptographically salted and hashed. OyoPasal personnel cannot view vendor passwords.
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <strong className="text-slate-900 dark:text-white block font-bold">Audit Logging & Tamper Resistance</strong>
              <span className="text-slate-600 dark:text-slate-400">
                Critical configuration changes, bank account modifications, and invitation activations are logged in immutable audit records.
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'vendor-data-retention',
      letter: 'K',
      title: 'Vendor Data Retention Schedules',
      summary: 'Statutory compliance under Nepal tax regulations requiring 7-year financial record retention.',
      icon: Clock,
      content: (
        <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
          <p>
            OyoPasal retains vendor records in compliance with legal and statutory requirements of Nepal:
          </p>
          <ul className="list-disc list-inside space-y-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
            <li><strong>Tax Invoices & Commission Statements:</strong> Retained for a minimum of <strong>7 years</strong> under the <strong>Income Tax Act, 2058</strong> and <strong>Value Added Tax Act, 2052</strong> of Nepal.</li>
            <li><strong>KYC Documents & Identity Records:</strong> Stored securely throughout the active duration of the merchant partnership and for 5 years after account termination.</li>
            <li><strong>Operational Order Logs:</strong> Retained for 3 years to defend against chargeback disputes, consumer forum claims, and tax audits.</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'vendor-privacy-rights',
      letter: 'L',
      title: 'Vendor Privacy & Account Rights',
      summary: 'Rights to review business records, correct store profiles, and request account deactivation.',
      icon: Scale,
      content: (
        <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
          <p>
            Verified merchants can exercise specific rights regarding their business data:
          </p>
          <div className="space-y-2.5 text-xs sm:text-sm">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <strong className="text-slate-900 dark:text-white">1. Right to Review & Inspect:</strong>
              <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                Access product catalog, sales figures, and payout ledger statements directly through the Vendor Dashboard.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <strong className="text-slate-900 dark:text-white">2. Right to Rectify Store Details:</strong>
              <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                Update store operating hours, contact telephone, address, and branding. Changes to PAN/VAT or bank details require manual re-verification by platform administrators.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <strong className="text-slate-900 dark:text-white">3. Right to Account Termination:</strong>
              <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                Merchants may request account closure by emailing <code className="text-emerald-600 font-mono">merchant-privacy@oyopasal.com</code>, subject to fulfilling all active orders, clearing customer return requests, and resolving final payout settlements.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'third-party-sharing',
      letter: 'M',
      title: 'Third-Party Data Sharing & Regulatory Disclosures',
      summary: 'Sharing with logistics couriers, banking clearing houses, and mandatory statutory authorities.',
      icon: Server,
      content: (
        <div className="space-y-3 text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
          <p>
            OyoPasal shares merchant information strictly under contractual or statutory obligations:
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            <li><strong>Delivery Partners:</strong> Store pickup address and vendor contact telephone for parcel collection.</li>
            <li><strong>Banking Partners:</strong> Bank account numbers and settlement amounts to execute fund disbursements.</li>
            <li><strong>Government & Tax Authorities:</strong> Annual sales summaries, VAT deductions, and PAN records provided to the <strong>Inland Revenue Department (IRD)</strong> of Nepal in compliance with statutory reporting laws.</li>
            <li><strong>Judicial Authorities:</strong> Disclosure pursuant to valid court orders, subpoenas, or lawful law enforcement investigations.</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'vendor-responsibilities',
      letter: 'N',
      title: 'Vendor Responsibilities & Contractual Compliance',
      summary: 'Data protection obligations for store staff, password hygiene, and credential protection.',
      icon: Shield,
      content: (
        <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
          <p>
            All registered merchants and authorized staff must maintain rigorous data protection practices:
          </p>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 text-xs sm:text-sm">
            <h4 className="font-bold text-slate-900 dark:text-white">Required Security Obligations:</h4>
            <ul className="list-disc list-inside space-y-1.5 text-slate-600 dark:text-slate-400">
              <li>Maintain unique, complex passwords for vendor accounts and never share credentials across store staff.</li>
              <li>Dispose of printed customer packing slips and delivery labels securely after parcel handover.</li>
              <li>Notify OyoPasal within <strong>12 hours</strong> at <code className="text-emerald-600 font-mono">security@oyopasal.com</code> if a vendor account compromise or data breach is suspected.</li>
              <li>Ensure all onboarded staff members are trained on customer confidentiality obligations.</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 'contact-merchant-support',
      letter: 'O',
      title: 'Contact & Merchant Grievance Desk',
      summary: 'Official merchant support channels, legal compliance desk, and vendor relations in Kathmandu.',
      icon: Mail,
      content: (
        <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
          <p>
            For merchant privacy inquiries, bank detail update re-verifications, or data governance questions, contact our dedicated Merchant Relations Team:
          </p>
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <h4 className="font-bold text-slate-900 dark:text-white text-base">
              OyoPasal Merchant Relations & Privacy Desk
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Email: <a href="mailto:merchant-privacy@oyopasal.com" className="text-amber-600 underline font-semibold">merchant-privacy@oyopasal.com</a></span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Vendor Hotline: +977-1-5970001 (9 AM – 7 PM NPT)</span>
              </div>
              <div className="flex items-center gap-2.5 sm:col-span-2">
                <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Merchant Hub: OyoPasal Vendor Support Center, Ward 3, Pulchowk, Lalitpur, Kathmandu, Nepal</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
              Merchant verification and privacy tickets are acknowledged within <strong>24 business hours</strong> by our compliance team.
            </p>
          </div>
        </div>
      ),
    },
  ];

  // Filter sections by search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase();
    return sections.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.summary.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
    );
  }, [searchQuery, sections]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-slate-100 transition-colors duration-200 pb-16">
      {/* 1. Header Hero Banner (Warm Merchant Aesthetic: Deep Forest Emerald with Gold Accents) */}
      <div className="bg-gradient-to-b from-[#122B1E] via-[#1B4332] to-[#0D2418] text-white pt-10 pb-14 px-4 sm:px-6 lg:px-8 border-b border-[#C5A869]/30 shadow-md">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Breadcrumb & Audience Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-2 text-[#E8D5A3]/90">
              <Link to="/seller" className="hover:text-white transition-colors">Merchant Portal</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-white font-semibold">Vendor Privacy Policy</span>
            </div>

            {/* Audience Switcher Pill */}
            <div className="inline-flex items-center rounded-xl bg-black/40 p-1 border border-white/10 text-xs font-semibold backdrop-blur-xs">
              <Link
                to="/privacy-policy"
                className="px-3 py-1.5 rounded-lg text-emerald-200 hover:text-white transition-colors flex items-center gap-1"
              >
                <span>Customer Policy</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
              <span className="px-3 py-1.5 rounded-lg bg-[#C5A869] text-slate-950 font-bold shadow-xs">
                Vendor Policy
              </span>
            </div>
          </div>

          {/* Title & Document Badges */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C5A869]/20 border border-[#C5A869]/40 text-[#E8D5A3] text-xs font-semibold">
              <Building2 className="w-3.5 h-3.5" />
              <span>OyoPasal Merchant Partner Agreement · Version 2.4</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white font-display">
              Vendor Privacy Policy
            </h1>
            <p className="text-sm sm:text-base text-emerald-100/90 max-w-3xl leading-relaxed">
              Comprehensive data protection, KYC verification, payout handling, catalog rights, and customer data custodian rules for verified merchant partners operating on OyoPasal.
            </p>
          </div>

          {/* Document Meta Row */}
          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-[#E8D5A3]/80 border-t border-emerald-800/60">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#C5A869]" />
              <span>Last Updated: November 26, 2026</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#C5A869]" />
              <span>15 Commercial Sections · ~14 min read</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A869]" />
              <span>Compliant with Nepal Electronic Transactions Act & Tax Directives</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Layout Container: Zepto-style Sidebar TOC + Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Quick Highlights Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 flex items-center justify-center mb-2">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Customer Data Custodianship</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Customer details are provided strictly for order fulfillment. Off-platform marketing or exporting customer data is strictly prohibited.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mb-2">
              <DollarSign className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Protected Payouts & Banking</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Bank account numbers are encrypted at rest, masked in UI views, and restricted solely to verified Vendor Owners.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
            <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/80 text-sky-700 dark:text-sky-400 flex items-center justify-center mb-2">
              <Shield className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Vendor Isolation Guarantee</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              No competitor or other vendor can query or view your sales revenue, customer orders, inventory levels, or commission terms.
            </p>
          </div>
        </div>

        {/* Content Grid: TOC (Col 1) and Policy Sections (Col 2) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Sticky Sidebar Navigation (Zepto-style) */}
          <aside className="lg:col-span-4 sticky top-24 space-y-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Table of Contents
                </span>
                <span className="text-xs font-mono text-[#C5A869] font-bold">
                  15 Sections
                </span>
              </div>

              {/* In-page Filter Search Input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter sections (e.g. payout, KYC)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-[#C5A869] text-slate-900 dark:text-white"
                />
              </div>

              {/* Navigation List */}
              <nav className="space-y-1 max-h-[58vh] overflow-y-auto pr-1 text-xs">
                {filteredSections.map((sec) => {
                  const isActive = activeSection === sec.id;
                  return (
                    <a
                      key={sec.id}
                      href={`#${sec.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        setActiveSection(sec.id);
                        const el = document.getElementById(sec.id);
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${
                        isActive
                          ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/70 dark:text-[#E8D5A3] font-bold border border-amber-300 dark:border-amber-800'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span className="w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {sec.letter}
                      </span>
                      <span className="truncate">{sec.title}</span>
                    </a>
                  );
                })}
              </nav>

              {/* Utility Action Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Print this policy"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Document</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex-1 py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Copy policy share link"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Link to Vendor Portal */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600">
                Ready to manage your store?
              </span>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Open Merchant Dashboard
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Access your Live Dispatch Orders, Catalog & Inventory, Ledger settlements, and Store Profile.
              </p>
              <Link
                to="/seller"
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:underline pt-1"
              >
                <span>Launch Vendor Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </aside>

          {/* Main Policy Content (Col 2) */}
          <main className="lg:col-span-8 space-y-8">
            {filteredSections.map((sec) => {
              return (
                <section
                  key={sec.id}
                  id={sec.id}
                  className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5 scroll-mt-28"
                >
                  {/* Section Title Header */}
                  <div className="space-y-1.5 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-[#E8D5A3] flex items-center justify-center font-bold text-sm shrink-0 border border-amber-300 dark:border-amber-800/80">
                        {sec.letter}
                      </div>
                      <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{sec.title}</span>
                      </h2>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 pl-10.5">
                      {sec.summary}
                    </p>
                  </div>

                  {/* Section Content */}
                  <div>{sec.content}</div>
                </section>
              );
            })}
          </main>
        </div>
      </div>
    </div>
  );
}
