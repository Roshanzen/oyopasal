from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.views.decorators.csrf import ensure_csrf_cookie
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from rest_framework import generics, status, serializers
from rest_framework.exceptions import AuthenticationFailed
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
    CustomerRegistrationSerializer,
    VendorRegistrationSerializer,
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


class CustomerRegisterView(generics.CreateAPIView):
    """
    Dedicated Customer Registration Endpoint (POST /api/auth/register-customer/).
    Accepts ONLY full_name, email_or_phone, and password.
    Creates a user with role='CUSTOMER' and is_vendor=False.
    Does NOT auto-create a Store or VendorProfile.
    """
    queryset = User.objects.all()
    serializer_class = CustomerRegistrationSerializer
    permission_classes = [AllowAny]

    @extend_schema(
        summary="Customer Registration",
        description="Self-registration for Customers only. Never grants vendor/store access.",
        responses={201: UserDetailSerializer}
    )
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        user_data = UserDetailSerializer(user).data
        user_data['is_vendor'] = False
        user_data['has_vendor_access'] = False

        token_serializer = CustomTokenObtainPairSerializer()
        refresh = token_serializer.get_token(user)
        access_token = str(refresh.access_token)

        return Response({
            'success': True,
            'message': 'Customer account created successfully.',
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


class VendorRegisterView(generics.CreateAPIView):
    """
    Vendor / Partner Store Registration Endpoint (POST /api/auth/register-vendor/).
    Triggered exclusively from 'Become a Seller / Apply to Become a Partner Store'.
    Requires merchant-specific fields: owner_name, store_name, store_category,
    store_address, email_or_phone, password, and optional pan_vat_number.
    Creates user with role='VENDOR' and linked Store with is_verified=False (status='PENDING').
    """
    queryset = User.objects.all()
    serializer_class = VendorRegistrationSerializer
    permission_classes = [AllowAny]

    @extend_schema(
        summary="Vendor / Merchant Store Registration",
        description="Merchant partner application to register store and vendor profile awaiting admin verification.",
        responses={201: UserDetailSerializer}
    )
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        user_data = UserDetailSerializer(user).data
        user_data['is_vendor'] = True
        user_data['has_vendor_access'] = True

        token_serializer = CustomTokenObtainPairSerializer()
        refresh = token_serializer.get_token(user)
        access_token = str(refresh.access_token)

        vp = getattr(user, 'vendor_profile', None)
        v_dict = None
        if vp:
            v_dict = {
                'id': str(vp.id),
                'name': vp.business_name,
                'business_name': vp.business_name,
                'status': vp.status,
                'approval_status': str(vp.status).lower(),
                'is_approved': False,
                'is_verified': False,
                'slug': vp.slug,
            }

        return Response({
            'success': True,
            'message': 'Seller application submitted successfully! Your store is pending admin approval.',
            'token': access_token,
            'access': access_token,
            'refresh': str(refresh),
            'tokens': {
                'access': access_token,
                'refresh': str(refresh)
            },
            'user': user_data,
            'vendor': v_dict,
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


class VendorLoginView(APIView):
    """
    Merchant Login Endpoint (POST /api/auth/login-vendor/ on /seller).
    Strictly verifies that the authenticated user has role='VENDOR' (or VENDOR_OWNER/STAFF/ADMIN)
    AND an associated Store / VendorProfile.
    If a CUSTOMER-only account attempts to log into /seller, returns HTTP 403 Forbidden with:
    "This account is registered as a Customer only. Please click 'Apply to Become a Partner Store' to register a seller store."
    """
    permission_classes = [AllowAny]

    @extend_schema(
        summary="Vendor / Merchant Portal Login",
        description="Authenticate merchant credentials to access the Vendor Portal. Requires a valid vendor profile.",
        responses={200: dict}
    )
    def post(self, request, *args, **kwargs):
        serializer = CustomTokenObtainPairSerializer(data=request.data, context={'request': request})
        try:
            serializer.is_valid(raise_exception=True)
        except AuthenticationFailed as e:
            detail_msg = e.detail if hasattr(e, 'detail') else 'Invalid credentials provided.'
            if isinstance(detail_msg, dict) and 'detail' in detail_msg:
                detail_msg = detail_msg['detail']
            return Response({'detail': detail_msg}, status=status.HTTP_401_UNAUTHORIZED)
        except serializers.ValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.user
        is_admin = getattr(user, 'role', '') in [UserRole.SUPER_ADMIN, UserRole.ADMIN, 'SUPER_ADMIN', 'ADMIN'] or user.is_superuser or user.is_staff
        vp = getattr(user, 'vendor_profile', None)
        has_staff_role = hasattr(user, 'vendor_staff_roles') and user.vendor_staff_roles.exists()

        if not is_admin:
            from apps.vendors.models import SellerApplication, SellerApplicationStatus, VendorInvitation, VendorStatus
            from django.db.models import Q

            # Check if user has an application or active invitation
            seller_app = SellerApplication.objects.filter(
                Q(email__iexact=user.email) | Q(applicant_user=user)
            ).order_by('-created_at').first()

            active_invitation = VendorInvitation.objects.filter(
                email__iexact=user.email,
                is_used=False
            ).order_by('-created_at').first()
            is_invitation_active = bool(active_invitation and active_invitation.is_valid())

            # Case 1: Account has an invitation awaiting activation
            if is_invitation_active or (seller_app and seller_app.status == SellerApplicationStatus.INVITATION_SENT):
                b_name = seller_app.business_name if seller_app else (vp.business_name if vp else 'your store')
                app_no = seller_app.application_number if seller_app else ''
                msg = f"Your seller application for '{b_name}' has been approved! Please activate your merchant account via the secure invitation link sent to {user.email}."
                return Response({
                    'success': False,
                    'detail': msg,
                    'error': {
                        'code': 'ACCOUNT_AWAITING_ACTIVATION',
                        'message': msg,
                        'application_number': app_no,
                        'business_name': b_name,
                        'email': user.email,
                        'action': 'ACTIVATE_ACCOUNT',
                    }
                }, status=status.HTTP_403_FORBIDDEN)

            # Case 2: User has a pending or under-review seller application
            if seller_app and seller_app.status in [SellerApplicationStatus.PENDING, SellerApplicationStatus.UNDER_REVIEW]:
                msg = f"Your seller application ({seller_app.application_number}) for '{seller_app.business_name}' is currently pending administrative review. You will receive an invitation once approved."
                return Response({
                    'success': False,
                    'detail': msg,
                    'error': {
                        'code': 'APPLICATION_PENDING_REVIEW',
                        'message': msg,
                        'application_number': seller_app.application_number,
                        'business_name': seller_app.business_name,
                        'email': user.email,
                        'action': 'TRACK_APPLICATION',
                        'track_url': f"/seller/track?app={seller_app.application_number}&email={user.email}",
                    }
                }, status=status.HTTP_403_FORBIDDEN)

            # Case 3: Application was rejected
            if seller_app and seller_app.status == SellerApplicationStatus.REJECTED and not vp:
                msg = f"Your seller application ({seller_app.application_number}) was not approved. Reason: {seller_app.rejection_reason or 'Details provided did not meet verification criteria.'}"
                return Response({
                    'success': False,
                    'detail': msg,
                    'error': {
                        'code': 'APPLICATION_REJECTED',
                        'message': msg,
                        'application_number': seller_app.application_number,
                        'action': 'CONTACT_SUPPORT',
                    }
                }, status=status.HTTP_403_FORBIDDEN)

            # Case 4: Pure Customer account without vendor profile or staff roles and no seller application
            if (getattr(user, 'role', '') == UserRole.CUSTOMER and not vp) or (not vp and not has_staff_role):
                return Response({
                    'success': False,
                    'detail': "This account is registered as a Customer only. Please click 'Apply to Become a Partner Store' to register a seller store.",
                    'error': {
                        'code': 'CUSTOMER_ACCOUNT_ONLY',
                        'message': "This account is registered as a Customer only. Please click 'Apply to Become a Partner Store' to register a seller store.",
                        'action': 'APPLY_SELLER',
                    }
                }, status=status.HTTP_403_FORBIDDEN)

            # Case 5: Has vendor profile, check verification & status
            if vp:
                has_verified_store = vp.stores.filter(is_verified=True).exists()
                is_approved = (vp.status in [VendorStatus.APPROVED, 'APPROVED']) or has_verified_store
                if not is_approved:
                    if vp.status in [VendorStatus.PENDING, 'PENDING', 'UNDER_REVIEW']:
                        msg = f"Your seller application for '{vp.business_name}' is currently pending administrative review. You will receive an invitation once approved."
                        err_code = "APPLICATION_PENDING_REVIEW"
                    elif vp.status in [VendorStatus.REJECTED, 'REJECTED']:
                        msg = "Your seller application has been rejected. Please contact OyoPasal Merchant Support."
                        err_code = "APPLICATION_REJECTED"
                    elif vp.status in [VendorStatus.SUSPENDED, 'SUSPENDED']:
                        msg = "Your vendor account has been suspended by administration. Please contact OyoPasal Support."
                        err_code = "ACCOUNT_SUSPENDED"
                    else:
                        msg = "Your seller account is awaiting activation. Please click the invitation link sent to your email to set your password."
                        err_code = "ACCOUNT_AWAITING_ACTIVATION"
                    return Response({
                        'success': False,
                        'detail': msg,
                        'error': {
                            'code': err_code,
                            'message': msg,
                            'business_name': vp.business_name,
                            'action': 'ACTIVATE_ACCOUNT' if err_code == 'ACCOUNT_AWAITING_ACTIVATION' else 'TRACK_APPLICATION',
                        }
                    }, status=status.HTTP_403_FORBIDDEN)

        # If admin without personal vendor_profile, allow specifying target or default to first
        if is_admin and not vp:
            vendor_id = request.data.get('vendor_id')
            if vendor_id:
                from apps.common.utils import is_valid_uuid
                vp = VendorProfile.objects.filter(id=vendor_id).first() if is_valid_uuid(vendor_id) else VendorProfile.objects.filter(slug=vendor_id).first()
            if not vp:
                vp = VendorProfile.objects.first()

        res_data = dict(serializer.validated_data)
        if vp:
            has_verified_store = vp.stores.filter(is_verified=True).exists()
            is_approved = (vp.status == 'APPROVED') or has_verified_store
            effective_status = 'APPROVED' if is_approved else vp.status
            v_dict = {
                'id': str(vp.id),
                'name': vp.business_name,
                'business_name': vp.business_name,
                'status': effective_status,
                'approval_status': 'approved' if is_approved else str(effective_status).lower(),
                'is_approved': is_approved,
                'is_verified': is_approved,
                'slug': vp.slug,
            }
            res_data['vendor'] = v_dict
            if 'user' in res_data and isinstance(res_data['user'], dict):
                res_data['user']['vendor'] = v_dict
                res_data['user']['has_vendor_access'] = True
                res_data['user']['is_vendor'] = True

        return Response(res_data, status=status.HTTP_200_OK)


SellerLoginView = VendorLoginView


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


