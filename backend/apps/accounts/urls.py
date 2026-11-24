from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView
from apps.accounts.views import (
    RegisterView,
    CustomerRegisterView,
    VendorRegisterView,
    CustomTokenObtainPairView,
    VendorLoginView,
    SellerLoginView,
    FirebaseLoginView,
    MeView,
    ChangePasswordView,
    LogoutView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    AccountActivationView,
    CsrfTokenView,
)

app_name = 'accounts'

urlpatterns = [
    path('csrf/', CsrfTokenView.as_view(), name='csrf_token'),
    path('register/', RegisterView.as_view(), name='register'),
    path('register-customer/', CustomerRegisterView.as_view(), name='register_customer'),
    path('register-vendor/', VendorRegisterView.as_view(), name='register_vendor'),
    path('login/', CustomTokenObtainPairView.as_view(), name='login'),
    path('login-vendor/', VendorLoginView.as_view(), name='login_vendor'),
    path('seller/login/', SellerLoginView.as_view(), name='seller_login'),
    path('firebase-login/', FirebaseLoginView.as_view(), name='firebase_login'),
    path('firebase/', FirebaseLoginView.as_view(), name='firebase_login_alias'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', MeView.as_view(), name='me'),
    path('user/', MeView.as_view(), name='user_alias'),
    path('password-change/', ChangePasswordView.as_view(), name='password_change'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='password_reset_request'),
    path('password-reset-confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    path('activate/', AccountActivationView.as_view(), name='account_activation'),
]

