import re
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils.text import slugify
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from drf_spectacular.utils import extend_schema_field
from apps.accounts.models import UserRole
from apps.customers.models import CustomerProfile
from apps.vendors.models import VendorProfile, VendorStatus

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

        return token

    def validate(self, attrs):
        raw_id = (
            self.initial_data.get('phone_or_email') or 
            self.initial_data.get('identifier') or 
            self.initial_data.get('email') or 
            self.initial_data.get('phone_number') or
            self.initial_data.get('phone') or
            self.initial_data.get('username') or
            attrs.get('phone_or_email') or
            attrs.get('identifier') or
            attrs.get('email') or
            attrs.get('phone_number') or
            attrs.get('phone')
        )
        vendor_id = self.initial_data.get('vendor_id') or attrs.get('vendor_id')
        password = self.initial_data.get('password') or attrs.get('password')

        # Mandatory credentials check: password must always be provided
        if not password:
            raise serializers.ValidationError({"detail": "Password is required."})

        target_user = None

        # 1. Direct login by vendor_id (requires vendor account password)
        if vendor_id and not raw_id:
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

        if not target_user:
            raise AuthenticationFailed({"detail": "Invalid credentials provided."})

        if not target_user.is_active:
            raise AuthenticationFailed({
                "code": "ACCOUNT_INACTIVE",
                "detail": "This account is inactive or disabled. Please contact customer support."
            })

        # Enforce password verification unconditionally
        if not target_user.check_password(password):
            raise AuthenticationFailed({"detail": "Invalid credentials provided."})

        # If a vendor_id was explicitly requested, ensure user owns that vendor profile
        if vendor_id:
            from apps.common.utils import is_valid_uuid
            user_vp = getattr(target_user, 'vendor_profile', None)
            if not user_vp:
                raise serializers.ValidationError({"detail": "Account is not associated with this vendor store."})
            matches = str(user_vp.id) == str(vendor_id) or user_vp.slug == str(vendor_id)
            if not matches and getattr(target_user, 'role', '') not in ['SUPER_ADMIN', 'ADMIN']:
                raise serializers.ValidationError({"detail": "Account is not authorized for this vendor store."})

        self.user = target_user
        refresh = self.get_token(target_user)
        data = {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }

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
            has_verified_store = vp.stores.filter(is_verified=True).exists()
            is_approved = (vp.status == 'APPROVED') or has_verified_store
            effective_status = 'APPROVED' if is_approved else vp.status
            approval_status = 'approved' if is_approved else str(effective_status).lower()
            vendor_dict = {
                'id': str(vp.id),
                'name': vp.business_name,
                'business_name': vp.business_name,
                'status': effective_status,
                'approval_status': approval_status,
                'is_approved': is_approved,
                'is_verified': is_approved,
                'slug': vp.slug
            }
            data['user']['vendor'] = vendor_dict
            data['user']['has_vendor_access'] = True
            data['user']['is_vendor'] = True
            data['vendor'] = vendor_dict
        elif hasattr(user, 'vendor_staff_roles') and user.vendor_staff_roles.exists():
            staff = user.vendor_staff_roles.select_related('vendor').first()
            if staff and staff.vendor:
                vp = staff.vendor
                vendor_dict = {
                    'id': str(vp.id),
                    'name': vp.business_name,
                    'business_name': vp.business_name,
                    'status': vp.status,
                    'approval_status': str(vp.status).lower(),
                    'is_approved': vp.status == 'APPROVED',
                    'is_verified': True,
                    'slug': vp.slug
                }
                data['user']['vendor'] = vendor_dict
                data['user']['has_vendor_access'] = True
                data['user']['is_vendor'] = True
                data['vendor'] = vendor_dict
            else:
                data['user']['has_vendor_access'] = False
                data['user']['is_vendor'] = False
        else:
            data['user']['has_vendor_access'] = False
            data['user']['is_vendor'] = False

        return data


class CustomerRegistrationSerializer(serializers.Serializer):
    """
    Customer-only registration serializer (POST /api/auth/register-customer/).
    Accepts ONLY full_name, email_or_phone, and password.
    Creates a user with role='CUSTOMER' and is_vendor=False.
    Does NOT auto-create a Store or VendorProfile.
    """
    full_name = serializers.CharField(required=True, max_length=150)
    email_or_phone = serializers.CharField(required=False, allow_blank=True, max_length=150)
    phone_or_email = serializers.CharField(required=False, allow_blank=True, max_length=150)
    password = serializers.CharField(required=True, write_only=True, min_length=6)

    def validate(self, attrs):
        raw_contact = (attrs.get('email_or_phone') or attrs.get('phone_or_email') or '').strip()
        if not raw_contact:
            raise serializers.ValidationError({'email_or_phone': 'Email address or mobile number is required.'})

        email = ''
        phone_number = None
        if '@' in raw_contact:
            email = raw_contact.lower()
            if User.objects.filter(email__iexact=email).exists():
                raise serializers.ValidationError({'email_or_phone': 'An account with this email address already exists. Please log in.'})
            attrs['email'] = email
            attrs['phone_number'] = None
        else:
            phone_number = normalize_phone_number(raw_contact)
            if not phone_number or len(phone_number) < 7:
                raise serializers.ValidationError({'email_or_phone': 'Please enter a valid mobile number or email.'})
            phone_variants = [phone_number, f"+977{phone_number}", f"+977 {phone_number}", f"977{phone_number}"]
            if User.objects.filter(phone_number__in=phone_variants).exists():
                raise serializers.ValidationError({'email_or_phone': 'An account with this phone number already exists. Please log in.'})
            attrs['phone_number'] = phone_number
            synthetic_email = f"{phone_number}@phone.oyopasal.com"
            if User.objects.filter(email__iexact=synthetic_email).exists():
                raise serializers.ValidationError({'email_or_phone': 'An account with this phone number already exists. Please log in.'})
            attrs['email'] = synthetic_email

        password = attrs.get('password')
        try:
            validate_password(password)
        except DjangoValidationError as e:
            raise serializers.ValidationError({'password': list(e.messages)})

        full_name = attrs.get('full_name', '').strip()
        parts = full_name.split(' ', 1)
        attrs['first_name'] = parts[0]
        attrs['last_name'] = parts[1] if len(parts) > 1 else ''

        return attrs

    def create(self, validated_data):
        email = validated_data['email']
        phone_number = validated_data.get('phone_number')
        first_name = validated_data.get('first_name', '')
        last_name = validated_data.get('last_name', '')
        password = validated_data['password']

        with transaction.atomic():
            user = User.objects.create_user(
                email=email,
                phone_number=phone_number,
                first_name=first_name,
                last_name=last_name,
                password=password,
                role=UserRole.CUSTOMER,
                is_active=True,
                is_verified=False
            )
            CustomerProfile.objects.create(user=user)
            # Strictly do NOT create a VendorProfile or Store here!
        return user


class VendorRegistrationSerializer(serializers.Serializer):
    """
    Vendor / Partner Store Registration Serializer (POST /api/auth/register-vendor/).
    Triggered exclusively from 'Become a Seller / Apply to Become a Partner Store'.
    Requires merchant-specific fields: owner_name, store_name, store_category,
    store_address, email_or_phone, password, and optional pan_vat_number.
    Creates user with role='VENDOR' and linked Store with is_verified=False (status='PENDING').
    """
    owner_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    contact_person = serializers.CharField(required=False, allow_blank=True, max_length=150)
    full_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    store_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    business_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    store_category = serializers.CharField(required=False, allow_blank=True, max_length=100)
    category = serializers.CharField(required=False, allow_blank=True, max_length=100)
    store_address = serializers.CharField(required=False, allow_blank=True, max_length=255)
    address = serializers.CharField(required=False, allow_blank=True, max_length=255)
    area = serializers.CharField(required=False, allow_blank=True, max_length=255)
    city = serializers.CharField(required=False, allow_blank=True, max_length=100, default='Kathmandu')
    email_or_phone = serializers.CharField(required=False, allow_blank=True, max_length=150)
    phone_or_email = serializers.CharField(required=False, allow_blank=True, max_length=150)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=50)
    email = serializers.CharField(required=False, allow_blank=True, max_length=150)
    password = serializers.CharField(required=False, allow_blank=True, write_only=True, min_length=6)
    pan_vat_number = serializers.CharField(required=False, allow_blank=True, max_length=50)

    def validate(self, attrs):
        owner = (attrs.get('owner_name') or attrs.get('contact_person') or attrs.get('full_name') or '').strip()
        if not owner:
            raise serializers.ValidationError({'owner_name': 'Owner / contact person name is required.'})
        attrs['owner_name'] = owner

        store = (attrs.get('store_name') or attrs.get('business_name') or '').strip()
        if not store:
            raise serializers.ValidationError({'store_name': 'Store / business name is required.'})
        attrs['store_name'] = store

        raw_contact = (attrs.get('email_or_phone') or attrs.get('phone_or_email') or attrs.get('email') or attrs.get('phone') or '').strip()
        if not raw_contact:
            raise serializers.ValidationError({'email_or_phone': 'Email address or mobile phone number is required.'})

        email = ''
        phone_number = None
        if '@' in raw_contact:
            email = raw_contact.lower()
            attrs['email'] = email
            if attrs.get('phone'):
                phone_number = normalize_phone_number(attrs.get('phone'))
                attrs['phone_number'] = phone_number
        else:
            phone_number = normalize_phone_number(raw_contact)
            attrs['phone_number'] = phone_number
            if attrs.get('email') and '@' in attrs.get('email'):
                email = attrs.get('email').strip().lower()
                attrs['email'] = email
            else:
                email = f"vendor_{phone_number}@phone.oyopasal.com"
                attrs['email'] = email

        pwd = attrs.get('password')
        if not pwd:
            pwd = f"StorePass{phone_number[-4:] if phone_number else '123'}!"
            attrs['password'] = pwd

        category = (attrs.get('store_category') or attrs.get('category') or 'General').strip()
        attrs['store_category'] = category

        addr = (attrs.get('store_address') or attrs.get('address') or attrs.get('area') or '').strip()
        if not addr:
            addr = attrs.get('city', 'Kathmandu').strip()
        attrs['store_address'] = addr

        return attrs

    def create(self, validated_data):
        from apps.stores.models import Store
        owner_name = validated_data['owner_name']
        store_name = validated_data['store_name']
        category = validated_data['store_category']
        store_address = validated_data['store_address']
        email = validated_data['email']
        phone_number = validated_data.get('phone_number')
        password = validated_data['password']
        pan_vat = validated_data.get('pan_vat_number', '').strip()

        parts = owner_name.split(' ', 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else 'Owner'

        with transaction.atomic():
            user = User.objects.filter(email__iexact=email).first()
            if not user and phone_number:
                phone_variants = [phone_number, f"+977{phone_number}", f"+977 {phone_number}", f"977{phone_number}"]
                user = User.objects.filter(phone_number__in=phone_variants).first()

            if user:
                # Upgrade role to VENDOR
                user.role = UserRole.VENDOR
                user.first_name = first_name
                user.last_name = last_name
                if not user.phone_number and phone_number:
                    user.phone_number = phone_number
                user.save()
            else:
                user = User.objects.create_user(
                    email=email,
                    phone_number=phone_number,
                    first_name=first_name,
                    last_name=last_name,
                    password=password,
                    role=UserRole.VENDOR,
                    is_active=True,
                    is_verified=False
                )

            base_slug = slugify(store_name) or f"store-{str(user.id)[:8]}"
            slug = base_slug
            counter = 1
            while VendorProfile.objects.filter(slug=slug).exclude(user=user).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1

            vendor_profile, _ = VendorProfile.objects.update_or_create(
                user=user,
                defaults={
                    'business_name': store_name,
                    'slug': slug,
                    'business_category': category,
                    'pan_vat_number': pan_vat,
                    'status': VendorStatus.PENDING,
                }
            )

            store_slug = slug
            store_counter = 1
            while Store.objects.filter(slug=store_slug).exclude(vendor=vendor_profile).exists():
                store_slug = f"{slug}-{store_counter}"
                store_counter += 1

            Store.objects.update_or_create(
                vendor=vendor_profile,
                name=store_name,
                defaults={
                    'slug': store_slug,
                    'address': store_address,
                    'contact_email': user.email,
                    'contact_phone': user.phone_number or '',
                    'description': f"Official storefront of {store_name}",
                    'is_active': True,
                    'is_verified': False,  # Pending Admin approval in /admin
                }
            )

        return user


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
        try:
            validate_password(password)
        except DjangoValidationError as e:
            raise serializers.ValidationError({'password': list(e.messages)})

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
        if role in [UserRole.SUPER_ADMIN, UserRole.SUPPORT_ADMIN, UserRole.FINANCE_ADMIN, UserRole.OPERATIONS_ADMIN, UserRole.VENDOR_STAFF]:
            raise serializers.ValidationError({'role': f'Registration as {role} is not permitted via public signup.'})

        if role == UserRole.VENDOR_OWNER and not attrs.get('business_name'):
            raise serializers.ValidationError({'business_name': 'Business name is required for vendor registration.'})

        return attrs

    def create(self, validated_data):
        validated_data.pop('confirm_password', None)
        validated_data.pop('phone_or_email', None)
        validated_data.pop('full_name', None)
        business_name = validated_data.pop('business_name', None)
        validated_data.pop('company_name', None)
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

        return user


class UserDetailSerializer(serializers.ModelSerializer):
    """Complete serialized representation of current authenticated user."""
    full_name = serializers.CharField(read_only=True)
    profile = serializers.SerializerMethodField()
    vendor = serializers.SerializerMethodField()
    has_vendor_access = serializers.SerializerMethodField()
    is_vendor = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'phone_number', 'first_name', 'last_name',
            'full_name', 'role', 'is_verified', 'is_vendor', 'avatar_url',
            'created_at', 'profile', 'vendor', 'has_vendor_access'
        ]
        read_only_fields = ['id', 'email', 'role', 'is_verified', 'is_vendor', 'created_at']

    def get_is_vendor(self, obj):
        return getattr(obj, 'is_vendor', False)

    @extend_schema_field(serializers.DictField)
    def get_profile(self, obj):
        if hasattr(obj, 'customer_profile'):
            cp = obj.customer_profile
            return {
                'loyalty_points': cp.loyalty_points,
                'gender': cp.gender,
                'is_phone_verified': cp.is_phone_verified
            }
        return None

    @extend_schema_field(serializers.DictField)
    def get_vendor(self, obj):
        if hasattr(obj, 'vendor_profile'):
            vp = obj.vendor_profile
            has_verified_store = vp.stores.filter(is_verified=True).exists()
            is_approved = (vp.status == 'APPROVED') or has_verified_store
            effective_status = 'APPROVED' if is_approved else vp.status
            approval_status = 'approved' if is_approved else str(effective_status).lower()
            return {
                'id': str(vp.id),
                'name': vp.business_name,
                'business_name': vp.business_name,
                'slug': vp.slug,
                'status': effective_status,
                'approval_status': approval_status,
                'is_approved': is_approved,
                'is_verified': is_approved,
                'pan_vat_number': vp.pan_vat_number,
                'logo_url': vp.logo_url or '',
            }
        staff_roles = getattr(obj, 'vendor_staff_roles', None)
        if staff_roles:
            staff = staff_roles.select_related('vendor').first()
            if staff and staff.vendor:
                vp = staff.vendor
                return {
                    'id': str(vp.id),
                    'name': vp.business_name,
                    'business_name': vp.business_name,
                    'slug': vp.slug,
                    'status': vp.status,
                    'approval_status': str(vp.status).lower(),
                    'is_approved': vp.status == 'APPROVED',
                    'is_verified': True,
                    'logo_url': vp.logo_url or '',
                }
        return None

    def get_has_vendor_access(self, obj):
        return hasattr(obj, 'vendor_profile') or (
            hasattr(obj, 'vendor_staff_roles') and obj.vendor_staff_roles.exists()
        )


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


