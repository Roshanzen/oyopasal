import { useCallback } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { useAuthContext } from '../context/AuthContext';
import { useLanguageContext } from '../context/LanguageContext';
import { useToastContext } from '../context/ToastContext';
import { auth, googleAuthProvider } from '../lib/firebase';
import { authService, httpClient } from '../services';

export function useAuth() {
  const authCtx = useAuthContext();
  const { t } = useLanguageContext();
  const { showToast } = useToastContext();

  const signInWithGoogle = useCallback(async () => {
    const cred = await signInWithPopup(auth, googleAuthProvider);
    const token = await cred.user.getIdToken();
    const data = await authService.firebaseLogin({
      id_token: token,
      full_name: cred.user.displayName || undefined,
      phone: cred.user.phoneNumber || undefined,
    });
    if (data.success && data.user) {
      if (data.token) {
        httpClient.setToken(data.token);
      }
      authCtx.setUserDirect(data.user);
      authCtx.setLoginModalOpen(false);
      const firstName = (data.user.full_name || cred.user.displayName || 'Customer').split(' ')[0];
      showToast(t('toast.welcomeCustomer', { name: firstName }), 'success');
      return data.user;
    }
    throw new Error('Google authentication failed');
  }, [authCtx, showToast, t]);

  return {
    ...authCtx,
    signInWithGoogle,
  };
}
