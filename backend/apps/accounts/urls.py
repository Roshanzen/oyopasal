from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView
from apps.accounts.views import (
    RegisterView,
    CustomTokenObtainPairView,
    SellerLoginView,
    FirebaseLoginView,
    MeView,
    ChangePasswordView,
    LogoutView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    AccountActivationView,
)

app_name = 'accounts'

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', CustomTokenObtainPairView.as_view(), name='login'),
    path('seller/login/', SellerLoginView.as_view(), name='seller_login'),
    path('firebase-login/', FirebaseLoginView.as_view(), name='firebase_login'),
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

