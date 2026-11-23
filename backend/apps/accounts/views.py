from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.views.decorators.csrf import ensure_csrf_cookie
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from drf_spectacular.utils import extend_schema

from apps.accounts.serializers import (
    CustomTokenObtainPairSerializer,
    UserRegistrationSerializer,
    UserDetailSerializer,
    ChangePasswordSerializer,
    LogoutSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    AccountActivationSerializer,
)
from apps.accounts.models import UserRole

User = get_user_model()

class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Authenticate user and receive JWT access + refresh tokens with role and organization claims.
    """
    serializer_class = CustomTokenObtainPairSerializer

    @extend_schema(
        summary="User Login (JWT Token Obtain)",
        description="Authenticate via email and password to receive JWT tokens with RBAC claims.",
        responses={200: CustomTokenObtainPairSerializer}
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class RegisterView(generics.CreateAPIView):
    """
    Register a new Customer, Vendor Owner, or Supplier Owner account.
    """
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [AllowAny]

    @extend_schema(
        summary="User Registration",
        description="Self-registration for Customers, Vendors, and Wholesale Suppliers.",
        responses={201: UserDetailSerializer}
    )
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        user_data = UserDetailSerializer(user).data
        
        token_serializer = CustomTokenObtainPairSerializer()
        refresh = token_serializer.get_token(user)
        access_token = str(refresh.access_token)

        return Response({
            'success': True,
            'message': 'Account created successfully.',
            'token': access_token,
            'access': access_token,
            'refresh': str(refresh),
            'tokens': {
                'access': access_token,
                'refresh': str(refresh)
            },
            'user': user_data,
            'data': user_data
        }, status=status.HTTP_201_CREATED)


class MeView(APIView):
    """
    Retrieve or update profile details of the authenticated user.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Current User Profile",
        description="Retrieve active user profile, assigned roles, and organization references.",
        responses={200: UserDetailSerializer}
    )
    def get(self, request):
        serializer = UserDetailSerializer(request.user)
        payload = dict(serializer.data)
        payload['success'] = True
        payload['message'] = 'Profile retrieved successfully'
        payload['data'] = serializer.data
        return Response(payload)

    @extend_schema(
        summary="Update Current User Profile",
        description="Update personal details (names, phone, avatar) of authenticated user.",
        request=UserDetailSerializer,
        responses={200: UserDetailSerializer}
    )
    def patch(self, request):
        serializer = UserDetailSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        payload = dict(serializer.data)
        payload['success'] = True
        payload['message'] = 'Profile updated successfully'
        payload['data'] = serializer.data
        return Response(payload)

    def put(self, request):
        return self.patch(request)


class ChangePasswordView(APIView):
    """
    Secure password change for authenticated users.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Change Password",
        description="Update account password with validation against previous password.",
        request=ChangePasswordSerializer,
        responses={200: dict}
    )
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        if not user.check_password(serializer.validated_data['old_password']):
            return Response({
                'success': False,
                'error': {
                    'code': 'INVALID_OLD_PASSWORD',
                    'message': 'The old password entered is incorrect.',
                    'details': None
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(serializer.validated_data['new_password'])
        user.save()

        return Response({
            'success': True,
            'message': 'Password has been updated successfully.'
        })


class LogoutView(APIView):
    """
    Logout and blacklist the provided refresh token.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = LogoutSerializer

    @extend_schema(
        summary="User Logout",
        description="Blacklist refresh token to securely terminate user session.",
        request=LogoutSerializer,
        responses={200: dict}
    )
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        refresh_token = serializer.validated_data.get('refresh')
        if not refresh_token:
            return Response({
                'success': False,
                'error': {
                    'code': 'MISSING_TOKEN',
                    'message': 'Refresh token is required to logout.',
                    'details': None
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({
                'success': True,
                'message': 'Successfully logged out. Refresh token revoked.'
            })
        except TokenError as e:
            return Response({
                'success': False,
                'error': {
                    'code': 'INVALID_TOKEN',
                    'message': str(e),
                    'details': None
                }
            }, status=status.HTTP_400_BAD_REQUEST)


def _get_or_init_firebase_app():
    import firebase_admin
    from firebase_admin import credentials
    import os
    if firebase_admin._apps:
        return firebase_admin.get_app()
    
    cred_path = getattr(settings, 'FIREBASE_CREDENTIALS_PATH', None) or os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    if cred_path and os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        return firebase_admin.initialize_app(cred)
    
    try:
        return firebase_admin.initialize_app()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Firebase Admin default init failed: %s", e)
        return None


class FirebaseLoginView(APIView):
    """
    Authenticate or register customer via cryptographically verified Firebase JWT ID Token.
    Derives user claims strictly from verified token payload.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        id_token = request.data.get('id_token')
        if not id_token or not isinstance(id_token, str):
            return Response({
                'success': False,
                'error': {
                    'code': 'MISSING_TOKEN',
                    'message': 'A valid Firebase id_token string is required.'
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        # Cryptographically verify the ID token via Firebase Admin SDK
        try:
            import firebase_admin
            from firebase_admin import auth as fb_auth

            app = _get_or_init_firebase_app()
            if not app:
                return Response({
                    'success': False,
                    'error': {
                        'code': 'FIREBASE_UNAVAILABLE',
                        'message': 'Firebase authentication service is not configured or credentials are unavailable.'
                    }
                }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

            decoded_token = fb_auth.verify_id_token(id_token, app=app)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Firebase token verification failed: %s", e)
            return Response({
                'success': False,
                'error': {
                    'code': 'INVALID_FIREBASE_TOKEN',
                    'message': 'Invalid, expired, or forged Firebase ID token.'
                }
            }, status=status.HTTP_401_UNAUTHORIZED)

        # Strictly derive user identity from verified cryptographic claims
        verified_email = (decoded_token.get('email') or '').strip().lower()
        verified_phone = (decoded_token.get('phone_number') or '').strip()
        verified_name = decoded_token.get('name') or 'Customer'
        uid = decoded_token.get('uid')

        if not verified_email and not verified_phone:
            verified_email = f"fb_{uid}@oyopasal.com"

        user = None
        if verified_email:
            user = User.objects.filter(email__iexact=verified_email).first()
        if not user and verified_phone:
            user = User.objects.filter(phone_number=verified_phone).first()

        if not user:
            user = User.objects.create_user(
                email=verified_email,
                phone_number=verified_phone or None,
                first_name=verified_name,
                role=UserRole.CUSTOMER,
                is_verified=True
            )
        elif not user.is_active:
            return Response({
                'success': False,
                'error': {
                    'code': 'ACCOUNT_INACTIVE',
                    'message': 'This account has been disabled. Please contact customer support.'
                }
            }, status=status.HTTP_403_FORBIDDEN)

        serializer = CustomTokenObtainPairSerializer()
        refresh = serializer.get_token(user)
        user_data = UserDetailSerializer(user).data
        return Response({
            'success': True,
            'token': str(refresh.access_token),
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': user_data,
            'data': user_data
        }, status=status.HTTP_200_OK)


class SellerLoginView(CustomTokenObtainPairView):
    """
    Vendor / Merchant Portal login.
    """
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        res_data = dict(serializer.validated_data)
        user = serializer.user

        vp = getattr(user, 'vendor_profile', None)
        if not vp:
            from apps.vendors.models import VendorProfile, VendorStatus
            from django.utils.text import slugify
            b_name = f"{user.first_name or 'My'} Local Store"
            b_slug = slugify(b_name) or f"store-{str(user.id)[:8]}"
            vp, _ = VendorProfile.objects.get_or_create(
                user=user,
                defaults={'business_name': b_name, 'slug': b_slug, 'status': VendorStatus.APPROVED}
            )

        v_dict = {
            'id': str(vp.id),
            'name': vp.business_name,
            'business_name': vp.business_name,
            'status': vp.status,
            'slug': vp.slug,
        }
        res_data['vendor'] = v_dict
        if 'user' in res_data and isinstance(res_data['user'], dict):
            res_data['user']['vendor'] = v_dict

        return Response(res_data, status=status.HTTP_200_OK)


class PasswordResetRequestView(APIView):
    """
    Initiate secure password reset by generating an encrypted UID and one-time token.
    Always returns success to prevent user enumeration attacks.
    """
    permission_classes = [AllowAny]

    @extend_schema(
        summary="Request Password Reset",
        request=PasswordResetRequestSerializer,
        responses={200: dict}
    )
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        raw_email = serializer.validated_data['email'].strip().lower()
        user = User.objects.filter(email__iexact=raw_email).first()
        if user and user.is_active:
            uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            try:
                send_mail(
                    subject="OyoPasal Password Reset",
                    message=f"Reset your password with UID: {uidb64} and Token: {token}",
                    from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@oyopasal.com'),
                    recipient_list=[user.email],
                    fail_silently=True
                )
            except Exception:
                pass

        return Response({
            'success': True,
            'message': 'If an account exists with this email, password reset instructions have been sent.'
        }, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    """
    Confirm password reset with verified token and set new password.
    """
    permission_classes = [AllowAny]

    @extend_schema(
        summary="Confirm Password Reset",
        request=PasswordResetConfirmSerializer,
        responses={200: dict}
    )
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uidb64 = serializer.validated_data['uidb64']
        token = serializer.validated_data['token']
        new_password = serializer.validated_data['new_password']

        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({
                'success': False,
                'error': {'code': 'INVALID_TOKEN', 'message': 'Invalid or expired password reset link.', 'details': None}
            }, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response({
                'success': False,
                'error': {'code': 'INVALID_TOKEN', 'message': 'Invalid or expired password reset link.', 'details': None}
            }, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()
        return Response({
            'success': True,
            'message': 'Password has been reset successfully. You can now login with your new password.'
        }, status=status.HTTP_200_OK)


class AccountActivationView(APIView):
    """
    Activate user account using verified one-time token.
    """
    permission_classes = [AllowAny]

    @extend_schema(
        summary="Activate Account",
        request=AccountActivationSerializer,
        responses={200: dict}
    )
    def post(self, request):
        serializer = AccountActivationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uidb64 = serializer.validated_data['uidb64']
        token = serializer.validated_data['token']

        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({
                'success': False,
                'error': {'code': 'INVALID_TOKEN', 'message': 'Invalid activation token.', 'details': None}
            }, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response({
                'success': False,
                'error': {'code': 'INVALID_TOKEN', 'message': 'Invalid or expired activation link.', 'details': None}
            }, status=status.HTTP_400_BAD_REQUEST)

        user.is_verified = True
        user.is_active = True
        user.save(update_fields=['is_verified', 'is_active'])
        return Response({
            'success': True,
            'message': 'Account activated successfully.'
        }, status=status.HTTP_200_OK)


@method_decorator(ensure_csrf_cookie, name='dispatch')
class CsrfTokenView(APIView):
    """
    Returns the CSRF token and sets the 'csrftoken' cookie.
    Allows SPA clients and session-authenticated requests to obtain a valid CSRF token.
    """
    permission_classes = [AllowAny]

    @extend_schema(
        summary="Get CSRF Token",
        description="Returns the active CSRF token and sets the csrftoken cookie.",
        responses={200: dict}
    )
    def get(self, request):
        token = get_token(request)
        return Response({
            'success': True,
            'csrfToken': token
        }, status=status.HTTP_200_OK)


