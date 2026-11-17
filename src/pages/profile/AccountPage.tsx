import React from 'react';
import { Bell, Heart, LifeBuoy, LogIn, LogOut, MapPin, Package, User } from 'lucide-react';
import { useAccountPortal } from '../../hooks/useAccountPortal';
import ProfileTab from '../../components/account/ProfileTab';
import OrdersTab from '../../components/account/OrdersTab';
import {
  AddressesTab,
  NotificationsTab,
  RefundRequestModal,
  SupportTab,
  WishlistTab,
} from '../../components/account/AccountSecondaryTabs';

export default function AccountPage() {
  const acc = useAccountPortal();

  return (
    <div className="w-full px-4 sm:px-6 lg:px-10 py-8 pb-24">
      <div className="pb-6 mb-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-display">
            {acc.t('account.title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{acc.t('account.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2.5">
          {!acc.user ? (
            <button
              type="button"
              onClick={() => acc.setLoginModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>
                {acc.t('header.login')} / {acc.t('header.signIn')}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={acc.logoutCustomer}
              className="px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/60 font-bold text-sm flex items-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{acc.t('header.signOut')}</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 space-y-2">
          <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-3 shadow-2xs space-y-1">
            {[
              { id: 'profile', icon: User, label: acc.t('account.tabProfile') },
              { id: 'orders', icon: Package, label: acc.t('account.tabOrders') },
              { id: 'addresses', icon: MapPin, label: acc.t('account.tabAddresses') },
              { id: 'wishlist', icon: Heart, label: acc.t('account.tabWishlist') },
              { id: 'notifications', icon: Bell, label: acc.t('account.tabNotifications') },
              { id: 'support', icon: LifeBuoy, label: acc.language === 'ne' ? 'ग्राहक सहायता' : 'Support & Help' },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => acc.setTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-colors text-left cursor-pointer ${
                    acc.activeTab === tab.id
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="md:col-span-3">
          {acc.activeTab === 'profile' && (
            <ProfileTab
              user={acc.user}
              fullName={acc.fullName}
              email={acc.email}
              phone={acc.phone}
              savingProfile={acc.savingProfile}
              syncingGoogle={acc.syncingGoogle}
              dbStatus={acc.dbStatus}
              t={acc.t}
              onOpenLogin={() => acc.setLoginModalOpen(true)}
              onChangeFullName={acc.setFullName}
              onChangePhone={acc.setPhone}
              onSaveProfile={acc.handleSaveProfile}
              onGoogleSignIn={acc.handleGoogleSignIn}
            />
          )}

          {acc.activeTab === 'orders' && (
            <OrdersTab
              user={acc.user}
              orders={acc.orders}
              loadingOrders={acc.loadingOrders}
              reorderingId={acc.reorderingId}
              language={acc.language}
              t={acc.t}
              formatPrice={acc.formatPrice}
              onOpenLogin={() => acc.setLoginModalOpen(true)}
              onReorder={acc.handleReorder}
              onRequestRefund={acc.setRefundOrder}
            />
          )}

          {acc.activeTab === 'addresses' && (
            <AddressesTab
              addresses={acc.addresses}
              t={acc.t}
              onAddAddress={() => acc.setLocationModalOpen(true)}
            />
          )}

          {acc.activeTab === 'wishlist' && (
            <WishlistTab
              wishlistProducts={acc.wishlistProducts}
              loadingWishlist={acc.loadingWishlist}
              t={acc.t}
            />
          )}

          {acc.activeTab === 'notifications' && (
            <NotificationsTab
              notifications={acc.notifications}
              t={acc.t}
              onMarkRead={acc.handleMarkNotifRead}
            />
          )}

          {acc.activeTab === 'support' && (
            <SupportTab
              tickets={acc.tickets}
              ticketCategory={acc.ticketCategory}
              ticketSubject={acc.ticketSubject}
              ticketMessage={acc.ticketMessage}
              creatingTicket={acc.creatingTicket}
              replyDrafts={acc.replyDrafts}
              language={acc.language}
              setTicketCategory={acc.setTicketCategory}
              setTicketSubject={acc.setTicketSubject}
              setTicketMessage={acc.setTicketMessage}
              onChangeReplyDraft={(ticketId, val) =>
                acc.setReplyDrafts((prev) => ({ ...prev, [ticketId]: val }))
              }
              onCreateTicket={acc.handleCreateTicket}
              onReplyTicket={acc.handleReplyTicket}
            />
          )}
        </div>
      </div>

      {acc.refundOrder && (
        <RefundRequestModal
          order={acc.refundOrder}
          reason={acc.refundReason}
          submitting={acc.submittingRefund}
          formatPrice={acc.formatPrice}
          onChangeReason={acc.setRefundReason}
          onClose={() => acc.setRefundOrder(null)}
          onSubmit={acc.handleSubmitRefund}
        />
      )}
    </div>
  );
}
