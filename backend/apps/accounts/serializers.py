import re
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.utils.text import slugify
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from drf_spectacular.utils import extend_schema_field
from apps.accounts.models import UserRole
from apps.customers.models import CustomerProfile
from apps.vendors.models import VendorProfile, VendorStatus
from apps.suppliers.models import SupplierProfile, SupplierStatus

User = get_user_model()


def normalize_phone_number(raw_phone: str) -> str:
    """Strip formatting and normalize local Nepal mobile numbers."""
    if not raw_phone:
        return ""
    cleaned = re.sub(r'[\s\-\(\)]', '', str(raw_phone).strip())
    if cleaned.startswith('+977'):
        cleaned = cleaned[4:]
    elif cleaned.startswith('977') and len(cleaned) == 13:
        cleaned = cleaned[3:]
    return cleaned


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Extends standard JWT serializer to attach role, ecosystem identity,
    and profile identifiers to the token claims and login response.
    Supports email or phone authentication, active status verification,
    and demo quick login.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields[self.username_field].required = False
        self.fields['password'].required = False
        self.fields['phone_or_email'] = serializers.CharField(required=False, allow_blank=True)
        self.fields['identifier'] = serializers.CharField(required=False, allow_blank=True)
        self.fields['vendor_id'] = serializers.CharField(required=False, allow_blank=True)
        self.fields['demo_quick_login'] = serializers.BooleanField(required=False, default=False)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Custom claims
        token['user_id'] = str(user.id)
        token['email'] = user.email
        token['role'] = user.role
        token['first_name'] = user.first_name
        token['last_name'] = user.last_name
        token['is_verified'] = user.is_verified

        # Attach tenant organization ID where applicable
        if hasattr(user, 'vendor_profile'):
            token['vendor_id'] = str(user.vendor_profile.id)
            token['vendor_status'] = user.vendor_profile.status
        elif hasattr(user, 'supplier_profile'):
            token['supplier_id'] = str(user.supplier_profile.id)
            token['supplier_status'] = user.supplier_profile.status

        return token

    def validate(self, attrs):
        raw_id = (
            self.initial_data.get('phone_or_email') or 
            self.initial_data.get('identifier') or 
            self.initial_data.get('email') or 
            self.initial_data.get('username') or
            attrs.get('phone_or_email') or
            attrs.get('identifier') or
            attrs.get('email')
        )
        vendor_id = self.initial_data.get('vendor_id') or attrs.get('vendor_id')
        password = self.initial_data.get('password') or attrs.get('password')
        demo_quick_login = bool(self.initial_data.get('demo_quick_login') or attrs.get('demo_quick_login', False))

        target_user = None

        # 1. Quick demo login or direct login by vendor_id
        if vendor_id and (demo_quick_login or not raw_id):
            from apps.common.utils import is_valid_uuid
            if is_valid_uuid(vendor_id):
                vp = VendorProfile.objects.filter(id=vendor_id).select_related('user').first()
            else:
                vp = VendorProfile.objects.filter(slug=vendor_id).select_related('user').first()
            if vp and vp.user:
                target_user = vp.user

        # 2. Look up user by phone or email
        if not target_user and raw_id:
            raw_id = str(raw_id).strip()
            from django.db.models import Q
            cleaned_phone = normalize_phone_number(raw_id)
            phone_queries = [raw_id]
            if cleaned_phone:
                phone_queries.extend([cleaned_phone, f"+977{cleaned_phone}", f"+977 {cleaned_phone}", f"977{cleaned_phone}"])

            target_user = User.objects.filter(
                Q(email__iexact=raw_id) | Q(phone_number__in=phone_queries)
            ).first()

        if target_user:
            if not target_user.is_active:
                raise serializers.ValidationError({
                    "code": "ACCOUNT_INACTIVE",
                    "detail": "This account is inactive or disabled. Please contact customer support."
                })

            if not demo_quick_login:
                if not password or not target_user.check_password(password):
                    raise serializers.ValidationError({"detail": "Invalid credentials provided."})
            self.user = target_user
            refresh = self.get_token(target_user)
            data = {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        elif demo_quick_login and raw_id:
            # Provision customer user for demo quick login
            email_val = raw_id if '@' in raw_id else f"{cleaned_phone or raw_id}@oyopasal.com"
            target_user = User.objects.create_user(
                email=email_val,
                phone_number=cleaned_phone if '@' not in raw_id else None,
                role=UserRole.CUSTOMER,
                first_name=self.initial_data.get('full_name', 'Customer'),
                is_verified=True
            )
            self.user = target_user
            refresh = self.get_token(target_user)
            data = {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        else:
            raise serializers.ValidationError({"detail": "Invalid credentials provided."})

        user = self.user
        data['token'] = data['access']
        data['tokens'] = {
            'access': data['access'],
            'refresh': data.get('refresh')
        }
        data['success'] = True
        data['user'] = {
            'id': str(user.id),
            'email': user.email,
            'full_name': user.full_name,
            'role': user.role,
            'is_verified': user.is_verified,
            'avatar_url': user.avatar_url,
            'phone': user.phone_number,
        }

        if hasattr(user, 'vendor_profile'):
            vp = user.vendor_profile
            data['user']['vendor'] = {
                'id': str(vp.id),
                'business_name': vp.business_name,
                'status': vp.status,
                'slug': vp.slug
            }
            data['vendor'] = {
                'id': str(vp.id),
                'name': vp.business_name,
                'business_name': vp.business_name,
                'status': vp.status,
                'slug': vp.slug
            }
        elif hasattr(user, 'supplier_profile'):
            data['user']['supplier'] = {
                'id': str(user.supplier_profile.id),
                'company_name': user.supplier_profile.company_name,
                'status': user.supplier_profile.status,
            }

        return data


class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    Multi-role registration serializer handling atomic profile creation for
    Customers, Vendors, and Suppliers. Supports both full_name/phone_or_email
    frontend payloads and canonical first_name/last_name/email forms.
    """
    email = serializers.EmailField(required=False, allow_blank=True)
    phone_number = serializers.CharField(required=False, allow_blank=True, max_length=20)
    phone_or_email = serializers.CharField(write_only=True, required=False, allow_blank=True)
    full_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    confirm_password = serializers.CharField(write_only=True, required=False, allow_blank=True, style={'input_type': 'password'})
    
    # Organization fields for business roles
    business_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    company_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    pan_vat_number = serializers.CharField(required=False, allow_blank=True, max_length=50)

    class Meta:
        model = User
        fields = [
            'id', 'email', 'phone_number', 'phone_or_email', 'full_name',
            'first_name', 'last_name', 'password', 'confirm_password', 'role',
            'business_name', 'company_name', 'pan_vat_number'
        ]
        read_only_fields = ['id']

    def validate(self, attrs):
        password = attrs.get('password')
        confirm_password = attrs.get('confirm_password')
        if confirm_password and password != confirm_password:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        validate_password(password)

        phone_or_email = attrs.get('phone_or_email', '').strip()
        email = attrs.get('email', '').strip()
        phone_number = attrs.get('phone_number', '').strip()

        if phone_or_email:
            if '@' in phone_or_email:
                email = phone_or_email.lower()
            else:
                phone_number = normalize_phone_number(phone_or_email)
                if not phone_number or len(phone_number) < 7:
                    raise serializers.ValidationError({'phone_or_email': 'Please enter a valid phone number or email address.'})

        if not email and not phone_number:
            raise serializers.ValidationError({'phone_or_email': 'Email or phone number is required.'})

        if email:
            email = email.lower()
            if User.objects.filter(email__iexact=email).exists():
                raise serializers.ValidationError({'email': 'An account with this email address already exists. Please log in instead.'})
            attrs['email'] = email
        else:
            synthetic_email = f"{phone_number}@phone.oyopasal.com"
            if User.objects.filter(email__iexact=synthetic_email).exists():
                raise serializers.ValidationError({'phone_number': 'An account with this phone number already exists. Please log in instead.'})
            attrs['email'] = synthetic_email

        if phone_number:
            cleaned = normalize_phone_number(phone_number)
            phone_variants = [phone_number, cleaned, f"+977{cleaned}", f"+977 {cleaned}"]
            if User.objects.filter(phone_number__in=phone_variants).exists():
                raise serializers.ValidationError({'phone_number': 'An account with this phone number already exists. Please log in instead.'})
            attrs['phone_number'] = cleaned

        full_name = attrs.get('full_name', '').strip()
        if full_name and not attrs.get('first_name'):
            parts = full_name.split(' ', 1)
            attrs['first_name'] = parts[0]
            attrs['last_name'] = parts[1] if len(parts) > 1 else ''

        role = attrs.get('role', UserRole.CUSTOMER)
        if role in [UserRole.SUPER_ADMIN, UserRole.SUPPORT_ADMIN, UserRole.FINANCE_ADMIN, UserRole.OPERATIONS_ADMIN, UserRole.VENDOR_STAFF, UserRole.SUPPLIER_STAFF]:
            raise serializers.ValidationError({'role': f'Registration as {role} is not permitted via public signup.'})

        if role == UserRole.VENDOR_OWNER and not attrs.get('business_name'):
            raise serializers.ValidationError({'business_name': 'Business name is required for vendor registration.'})

        if role == UserRole.SUPPLIER_OWNER and not attrs.get('company_name'):
            raise serializers.ValidationError({'company_name': 'Company name is required for supplier registration.'})

        return attrs

    def create(self, validated_data):
        validated_data.pop('confirm_password', None)
        validated_data.pop('phone_or_email', None)
        validated_data.pop('full_name', None)
        business_name = validated_data.pop('business_name', None)
        company_name = validated_data.pop('company_name', None)
        pan_vat_number = validated_data.pop('pan_vat_number', '')
        password = validated_data.pop('password')

        role = validated_data.get('role', UserRole.CUSTOMER)

        with transaction.atomic():
            user = User.objects.create_user(
                password=password,
                **validated_data
            )

            if role == UserRole.CUSTOMER:
                CustomerProfile.objects.create(user=user)
            elif role == UserRole.VENDOR_OWNER:
                base_slug = slugify(business_name) or str(user.id)[:8]
                slug = base_slug
                counter = 1
                while VendorProfile.objects.filter(slug=slug).exists():
                    slug = f"{base_slug}-{counter}"
                    counter += 1

                vendor_profile = VendorProfile.objects.create(
                    user=user,
                    business_name=business_name,
                    slug=slug,
                    pan_vat_number=pan_vat_number,
                    status=VendorStatus.PENDING
                )
                from apps.stores.models import Store
                Store.objects.create(
                    vendor=vendor_profile,
                    name=business_name,
                    slug=slug,
                    description=f"Official storefront of {business_name}",
                    contact_email=user.email,
                    is_active=True,
                    is_verified=False
                )
            elif role == UserRole.SUPPLIER_OWNER:
                base_slug = slugify(company_name) or str(user.id)[:8]
                slug = base_slug
                counter = 1
                while SupplierProfile.objects.filter(slug=slug).exists():
                    slug = f"{base_slug}-{counter}"
                    counter += 1

                SupplierProfile.objects.create(
                    user=user,
                    company_name=company_name,
                    slug=slug,
                    pan_vat_number=pan_vat_number,
                    status=SupplierStatus.PENDING
                )

        return user


class UserDetailSerializer(serializers.ModelSerializer):
    """Complete serialized representation of current authenticated user."""
    full_name = serializers.CharField(read_only=True)
    profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'phone_number', 'first_name', 'last_name',
            'full_name', 'role', 'is_verified', 'avatar_url',
            'created_at', 'profile'
        ]
        read_only_fields = ['id', 'email', 'role', 'is_verified', 'created_at']

    @extend_schema_field(serializers.DictField)
    def get_profile(self, obj):
        if hasattr(obj, 'customer_profile'):
            cp = obj.customer_profile
            return {
                'loyalty_points': cp.loyalty_points,
                'gender': cp.gender,
                'is_phone_verified': cp.is_phone_verified
            }
        elif hasattr(obj, 'vendor_profile'):
            vp = obj.vendor_profile
            return {
                'id': str(vp.id),
                'business_name': vp.business_name,
                'slug': vp.slug,
                'status': vp.status,
                'pan_vat_number': vp.pan_vat_number,
                'logo_url': vp.logo_url,
            }
        elif hasattr(obj, 'supplier_profile'):
            sp = obj.supplier_profile
            return {
                'id': str(sp.id),
                'company_name': sp.company_name,
                'slug': sp.slug,
                'status': sp.status,
                'credit_terms_days': sp.credit_terms_days,
            }
        return None


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True)
    confirm_new_password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_new_password']:
            raise serializers.ValidationError({'confirm_new_password': 'New passwords do not match.'})
        validate_password(attrs['new_password'])
        return attrs


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(required=True, help_text="JWT refresh token to revoke")


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.CharField(required=True, help_text="Registered email address or phone number")


class PasswordResetConfirmSerializer(serializers.Serializer):
    uidb64 = serializers.CharField(required=True)
    token = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, write_only=True, style={'input_type': 'password'})

    def validate(self, attrs):
        validate_password(attrs['new_password'])
        return attrs


class AccountActivationSerializer(serializers.Serializer):
    uidb64 = serializers.CharField(required=True)
    token = serializers.CharField(required=True)


