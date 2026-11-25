import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Building,
  CheckCircle2,
  FileText,
  HelpCircle,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Store,
  Upload,
  User,
  AlertCircle
} from 'lucide-react';
import { sellerOnboardingService, SellerApplicationPayload } from '../../services/sellerOnboardingService';
import { useApp } from '../../context';

const NEPAL_PROVINCES = [
  'Bagmati Province',
  'Koshi Province',
  'Madhesh Province',
  'Gandaki Province',
  'Lumbini Province',
  'Karnali Province',
  'Sudurpashchim Province',
];

const STORE_CATEGORIES = [
  'Grocery & Daily Staples',
  'Fresh Produce & Vegetables',
  'Bakery & Dairy Products',
  'Organic & Local Farm Specialties',
  'Electronics & Mobile Accessories',
  'Fashion & Apparel',
  'Health & Personal Care',
  'Home, Kitchen & Living',
  'Books, Stationery & Crafts',
  'General Department Store',
];

export default function BecomeSellerPage() {
  const navigate = useNavigate();
  const { showToast, user } = useApp();

  // Form State
  // A. Applicant Information
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [altPhone, setAltPhone] = useState('');

  // Prefill verified customer account data if logged in
  useEffect(() => {
    if (user) {
      if (!fullName) {
        setFullName(user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || '');
      }
      if (!email && user.email) {
        setEmail(user.email ?? '');
      }
      if (!phone && (user.phone || (user as any).phone_number)) {
        setPhone(user.phone || (user as any).phone_number || '');
      }
    }
  }, [user]);

  // B. Business Information
  const [businessName, setBusinessName] = useState('');
  const [businessCategory, setBusinessCategory] = useState(STORE_CATEGORIES[0]);
  const [businessDescription, setBusinessDescription] = useState('');
  const [businessContactPhone, setBusinessContactPhone] = useState('');
  const [businessContactEmail, setBusinessContactEmail] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [panVatNumber, setPanVatNumber] = useState('');

  // C. Store Location
  const [province, setProvince] = useState(NEPAL_PROVINCES[0]);
  const [district, setDistrict] = useState('Kathmandu');
  const [municipality, setMunicipality] = useState('Kathmandu Metropolitan');
  const [wardNumber, setWardNumber] = useState('');
  const [completeAddress, setCompleteAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // D. Documents
  const [registrationDocUrl, setRegistrationDocUrl] = useState('');
  const [panVatDocUrl, setPanVatDocUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  // E. Declaration
  const [declarationConfirmed, setDeclarationConfirmed] = useState(false);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedResult, setSubmittedResult] = useState<{
    application_number: string;
    business_name: string;
    email: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validations
    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      setFormError('Please fill in all required applicant information fields.');
      return;
    }
    if (!businessName.trim()) {
      setFormError('Please enter your store or business name.');
      return;
    }
    if (!completeAddress.trim()) {
      setFormError('Please enter your complete physical store address.');
      return;
    }
    if (!declarationConfirmed) {
      setFormError('You must confirm the application declaration before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: SellerApplicationPayload = {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        alt_phone: altPhone.trim() || undefined,
        business_name: businessName.trim(),
        business_category: businessCategory,
        business_description: businessDescription.trim() || undefined,
        business_contact_phone: businessContactPhone.trim() || phone.trim(),
        business_contact_email: businessContactEmail.trim() || email.trim(),
        registration_number: registrationNumber.trim() || undefined,
        pan_vat_number: panVatNumber.trim() || undefined,
        province,
        district: district.trim(),
        municipality: municipality.trim(),
        ward_number: wardNumber.trim() || undefined,
        complete_address: completeAddress.trim(),
        postal_code: postalCode.trim() || undefined,
        registration_doc_url: registrationDocUrl.trim() || undefined,
        pan_vat_doc_url: panVatDocUrl.trim() || undefined,
        logo_url: logoUrl.trim() || undefined,
        declaration_confirmed: true,
      };

      const res = await sellerOnboardingService.submitApplication(payload);
      setSubmittedResult({
        application_number: res.application_number,
        business_name: businessName.trim(),
        email: email.trim().toLowerCase(),
      });
      showToast('Seller application submitted successfully!', 'success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit application. Please check your inputs.';
      setFormError(msg);
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Confirmation Success Screen
  if (submittedResult) {
    return (
      <div className="min-h-[80vh] w-full bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="max-w-xl w-full bg-white dark:bg-[#0F172A] rounded-3xl p-8 sm:p-10 border border-slate-200 dark:border-slate-800 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-900/30">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60">
              Application Submitted
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-3">
              Application Under Review
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              Thank you for applying to sell on OyoPasal! Our administration team will review your business credentials.
            </p>
          </div>

          {/* Reference Box */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-left space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Application Reference</span>
              <span className="font-mono text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                {submittedResult.application_number}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Store Name</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{submittedResult.business_name}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Registered Email</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{submittedResult.email}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 text-left flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p>
              Once your application is approved by OyoPasal administrators, a secure, single-use activation invitation will be sent to your email to create your merchant password.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <Link
              to={`/seller/track?app=${encodeURIComponent(submittedResult.application_number)}&email=${encodeURIComponent(submittedResult.email)}`}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-colors"
            >
              <span>Track Application Status</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/"
              className="w-full sm:w-auto py-3 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm transition-colors text-center"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 py-10 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Storefront</span>
          </Link>
          <Link
            to="/seller/track"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            <span>Already applied? Track status</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Hero Section */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-900/30">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Apply to Become an OyoPasal Partner Store
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Join Nepal's premier hyper-local commerce network. Reach thousands of local neighborhood customers with automated dispatch and instant settlements.
          </p>
        </div>

        {formError && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs space-y-2">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <p className="font-semibold leading-relaxed">{formError}</p>
            </div>
            {formError.toLowerCase().includes('already') && (
              <div className="pt-1">
                <Link
                  to={`/seller/track?email=${encodeURIComponent(email.trim())}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors"
                >
                  <span>Track Application Status</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Application Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* SECTION A: Applicant Information */}
          <div className="bg-white dark:bg-[#0F172A] rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">A. Applicant Information</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Primary business owner and account administrator</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName ?? ''}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ramesh Shrestha"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email ?? ''}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. ramesh@gmail.com"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={phone ?? ''}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+977 9801234567"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Alternative Contact Number (Optional)
                </label>
                <input
                  type="tel"
                  value={altPhone ?? ''}
                  onChange={(e) => setAltPhone(e.target.value)}
                  placeholder="+977 01-4412345"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* SECTION B: Business Information */}
          <div className="bg-white dark:bg-[#0F172A] rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">B. Business & Store Information</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Store identity, category and legal identifiers</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Store / Business Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={businessName ?? ''}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Baneshwor Fresh Grocers"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Business Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={businessCategory ?? 'Fresh Produce'}
                  onChange={(e) => setBusinessCategory(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {STORE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  PAN / VAT Number (Optional initially)
                </label>
                <input
                  type="text"
                  value={panVatNumber ?? ''}
                  onChange={(e) => setPanVatNumber(e.target.value)}
                  placeholder="e.g. 601234567"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Business Description
                </label>
                <textarea
                  rows={3}
                  value={businessDescription ?? ''}
                  onChange={(e) => setBusinessDescription(e.target.value)}
                  placeholder="Tell us about the products you sell, your specialties, and your store history..."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Business Contact Phone
                </label>
                <input
                  type="tel"
                  value={businessContactPhone ?? ''}
                  onChange={(e) => setBusinessContactPhone(e.target.value)}
                  placeholder="e.g. 01-4412345 or +977 9800000000"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Company Registration Number
                </label>
                <input
                  type="text"
                  value={registrationNumber ?? ''}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  placeholder="e.g. REG-KTM-2080-1234"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* SECTION C: Store Location */}
          <div className="bg-white dark:bg-[#0F172A] rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">C. Store Physical Location</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Nepal administrative address for delivery dispatch</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Province <span className="text-rose-500">*</span>
                </label>
                <select
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {NEPAL_PROVINCES.map((prov) => (
                    <option key={prov} value={prov}>
                      {prov}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  District <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={district ?? ''}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="e.g. Kathmandu, Lalitpur, Bhaktapur"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Municipality / Local Body <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={municipality ?? ''}
                  onChange={(e) => setMunicipality(e.target.value)}
                  placeholder="e.g. Kathmandu Metropolitan"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Ward Number
                </label>
                <input
                  type="text"
                  value={wardNumber ?? ''}
                  onChange={(e) => setWardNumber(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Complete Street Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={completeAddress ?? ''}
                  onChange={(e) => setCompleteAddress(e.target.value)}
                  placeholder="e.g. New Baneshwor, Near Eyeplex Mall, Shop #12"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* SECTION D: Business Documents */}
          <div className="bg-white dark:bg-[#0F172A] rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">D. Business Documents & Logo</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">KYC verification files and storefront imagery</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Store Logo Image URL
                </label>
                <input
                  type="url"
                  value={logoUrl ?? ''}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://.../store-logo.jpg"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  PAN / VAT Certificate Document URL
                </label>
                <input
                  type="url"
                  value={panVatDocUrl ?? ''}
                  onChange={(e) => setPanVatDocUrl(e.target.value)}
                  placeholder="https://.../pan-vat.pdf"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Company Registration Certificate URL
                </label>
                <input
                  type="url"
                  value={registrationDocUrl ?? ''}
                  onChange={(e) => setRegistrationDocUrl(e.target.value)}
                  placeholder="https://.../company-registration.pdf"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* SECTION E: Declaration */}
          <div className="bg-white dark:bg-[#0F172A] rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-start gap-3">
              <input
                id="declaration"
                type="checkbox"
                required
                checked={Boolean(declarationConfirmed)}
                onChange={(e) => setDeclarationConfirmed(e.target.checked)}
                className="w-5 h-5 mt-0.5 rounded-md text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700 cursor-pointer"
              />
              <label htmlFor="declaration" className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed cursor-pointer select-none">
                <span className="font-bold text-slate-900 dark:text-white">Legal Declaration:</span> I hereby declare that all submitted information and documents are accurate, authentic, and complete. I agree to OyoPasal Merchant Partner Terms & Conditions. I understand that submitting this application does not guarantee automatic approval, and that my application will be reviewed and verified by OyoPasal administrators before store activation.
              </label>
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Applications are typically reviewed within 24–48 business hours.
            </p>
            <button
              type="submit"
              disabled={submitting || !declarationConfirmed}
              className="w-full sm:w-auto py-3.5 px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base shadow-lg shadow-emerald-900/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting Application...</span>
                </>
              ) : (
                <>
                  <span>Submit Seller Application</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
