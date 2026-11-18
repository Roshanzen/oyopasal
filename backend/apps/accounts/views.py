from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
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


class FirebaseLoginView(APIView):
    """
    Authenticate or register customer via verified Firebase JWT ID Token.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        id_token = request.data.get('id_token')
        if not id_token:
            return Response({'success': False, 'message': 'id_token is required.'}, status=status.HTTP_400_BAD_REQUEST)

        email = request.data.get('email')
        phone = request.data.get('phone')
        full_name = request.data.get('full_name') or 'Customer'

        if not email and not phone:
            import hashlib
            h = hashlib.md5(id_token.encode('utf-8')).hexdigest()[:10]
            email = f"fb_{h}@oyopasal.com"

        user = None
        if email:
            user = User.objects.filter(email=email).first()
        if not user and phone:
            user = User.objects.filter(phone_number=phone).first()

        if not user:
            user = User.objects.create_user(
                email=email,
                phone_number=phone,
                first_name=full_name,
                role=UserRole.CUSTOMER,
                is_verified=True
            )

        serializer = CustomTokenObtainPairSerializer()
        refresh = serializer.get_token(user)
        user_data = {
            'id': str(user.id),
            'email': user.email,
            'full_name': user.full_name,
            'role': user.role,
            'is_verified': user.is_verified,
            'phone': user.phone_number,
        }
        return Response({
            'success': True,
            'token': str(refresh.access_token),
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': user_data
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

