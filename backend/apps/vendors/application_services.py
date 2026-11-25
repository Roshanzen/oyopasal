import os
import uuid
import secrets
import logging
from datetime import timedelta
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.core.mail import send_mail
from rest_framework.exceptions import ValidationError

from apps.accounts.models import User, UserRole
from apps.vendors.models import (
    VendorProfile,
    VendorStatus,
    SellerApplication,
    SellerApplicationStatus,
    VendorInvitation,
    SellerApplicationAudit,
)
from apps.stores.models import Store

logger = logging.getLogger('apps.vendors.onboarding')


def send_seller_email(to_email: str, subject: str, message: str, html_message: str = None) -> bool:
    """Safely dispatches an email using Django's email configuration."""
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@oyopasal.com')
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=from_email,
            recipient_list=[to_email],
            html_message=html_message,
            fail_silently=False,
        )
        logger.info("Sent seller email '%s' to %s", subject, to_email)
        return True
    except Exception as e:
        logger.warning("Failed to send seller email '%s' to %s: %s", subject, to_email, e)
        return False


def generate_application_number(province: str = '') -> str:
    year = timezone.now().year
    code = secrets.token_hex(3).upper()
    return f"APP-{year}-{code}"


def create_seller_application(data: dict, applicant_user: User = None) -> SellerApplication:
    """Public submission of a new seller onboarding application."""
    email = data.get('email', '').strip().lower()
    phone = data.get('phone', '').strip()
    business_name = data.get('business_name', '').strip()

    if not email:
        raise ValidationError({'email': 'A valid email address is required.'})
    if not phone:
        raise ValidationError({'phone': 'A valid phone number is required.'})
    if not business_name:
        raise ValidationError({'business_name': 'Business or store name is required.'})

    # Link existing registered user only if email matches
    if applicant_user and applicant_user.email.strip().lower() != email:
        applicant_user = None
    if not applicant_user:
        applicant_user = User.objects.filter(email__iexact=email).first()

    # Check if this account is already an active approved vendor
    existing_user = applicant_user or User.objects.filter(email__iexact=email).first()
    if existing_user and hasattr(existing_user, 'vendor_profile'):
        vp = existing_user.vendor_profile
        if vp and (vp.status == VendorStatus.APPROVED or vp.stores.filter(is_verified=True).exists()):
            raise ValidationError({
                'detail': "An active seller store already exists for this email address. Please sign in directly to the Vendor Portal.",
                'code': 'VENDOR_ALREADY_ACTIVE'
            })

    # Check for active pending or under_review applications with same email or user
    existing_pending = SellerApplication.objects.filter(
        email__iexact=email,
        status__in=[
            SellerApplicationStatus.PENDING,
            SellerApplicationStatus.UNDER_REVIEW,
            SellerApplicationStatus.INVITATION_SENT,
        ]
    ).first()

    if not existing_pending and applicant_user:
        existing_pending = SellerApplication.objects.filter(
            applicant_user=applicant_user,
            status__in=[
                SellerApplicationStatus.PENDING,
                SellerApplicationStatus.UNDER_REVIEW,
                SellerApplicationStatus.INVITATION_SENT,
            ]
        ).first()

    if existing_pending:
        raise ValidationError({
            'detail': f"An active seller application ({existing_pending.application_number}) is already submitted with this email. Please track your application status.",
            'code': 'DUPLICATE_PENDING_APPLICATION',
            'application_number': existing_pending.application_number
        })

    # Generate unique application reference code
    app_num = generate_application_number(data.get('province', ''))
    while SellerApplication.objects.filter(application_number=app_num).exists():
        app_num = generate_application_number(data.get('province', ''))

    with transaction.atomic():
        application = SellerApplication.objects.create(
            application_number=app_num,
            applicant_user=applicant_user,
            full_name=data.get('full_name', '').strip(),
            email=email,
            phone=phone,
            alt_phone=data.get('alt_phone', '').strip(),
            business_name=business_name,
            business_category=data.get('business_category', 'General Retail'),
            business_description=data.get('business_description', '').strip(),
            business_contact_phone=data.get('business_contact_phone', phone).strip(),
            business_contact_email=data.get('business_contact_email', email).strip().lower(),
            registration_number=data.get('registration_number', '').strip(),
            pan_vat_number=data.get('pan_vat_number', '').strip(),
            province=data.get('province', '').strip(),
            district=data.get('district', '').strip(),
            municipality=data.get('municipality', '').strip(),
            ward_number=str(data.get('ward_number', '')).strip(),
            complete_address=data.get('complete_address', '').strip(),
            postal_code=data.get('postal_code', '').strip(),
            registration_doc_url=data.get('registration_doc_url', ''),
            pan_vat_doc_url=data.get('pan_vat_doc_url', ''),
            logo_url=data.get('logo_url', ''),
            supporting_docs=data.get('supporting_docs', []),
            declaration_confirmed=bool(data.get('declaration_confirmed', True)),
            status=SellerApplicationStatus.PENDING,
        )

        SellerApplicationAudit.objects.create(
            application=application,
            action='SUBMITTED',
            actor=applicant_user,
            notes='Seller application submitted via public portal.',
            previous_status='',
            new_status=SellerApplicationStatus.PENDING,
        )

    # Send receipt email
    subject = f"OyoPasal Seller Application Received — Reference: {app_num}"
    body = (
        f"Hello {application.full_name},\n\n"
        f"Thank you for applying to become a partner store on OyoPasal!\n"
        f"Your application reference number is: {app_num}\n"
        f"Store: {application.business_name}\n"
        f"Category: {application.business_category}\n\n"
        f"Our administration team will review your application and business details shortly. "
        f"You can track your application status at any time using your reference number and email.\n\n"
        f"Best regards,\n"
        f"OyoPasal Merchant Onboarding Team\n"
        f"Kathmandu, Nepal\n"
    )
    send_seller_email(email, subject, body)

    return application


def track_seller_application(application_number: str, email: str) -> dict:
    """Allows an applicant to verify their status securely without exposing internal fields."""
    app = SellerApplication.objects.filter(
        application_number__iexact=application_number.strip(),
        email__iexact=email.strip().lower()
    ).first()

    if not app:
        raise ValidationError({
            'detail': 'No application found matching the provided reference number and email address.',
            'code': 'APPLICATION_NOT_FOUND'
        })

    return {
        'application_number': app.application_number,
        'business_name': app.business_name,
        'business_category': app.business_category,
        'status': app.status,
        'submitted_at': app.created_at,
        'reviewed_at': app.reviewed_at,
        'rejection_reason': app.rejection_reason if app.status == SellerApplicationStatus.REJECTED else '',
        'additional_info_requested': app.additional_info_requested,
    }


def admin_update_status(
    application: SellerApplication,
    new_status: str,
    admin_user: User,
    notes: str = '',
    rejection_reason: str = '',
    additional_info: str = ''
) -> SellerApplication:
    """Updates status, logs audit event, and notifies applicant."""
    old_status = application.status
    if old_status == new_status and not notes and not additional_info and not rejection_reason:
        return application

    with transaction.atomic():
        application.status = new_status
        application.reviewed_by = admin_user
        application.reviewed_at = timezone.now()

        if notes:
            application.admin_notes = f"{application.admin_notes}\n[{timezone.now().strftime('%Y-%m-%d %H:%M')}] {admin_user.email}: {notes}".strip()
        if rejection_reason:
            application.rejection_reason = rejection_reason
        if additional_info:
            application.additional_info_requested = additional_info

        application.save()

        SellerApplicationAudit.objects.create(
            application=application,
            action=f"STATUS_{new_status}",
            actor=admin_user,
            notes=notes or rejection_reason or additional_info or f"Status changed to {new_status}",
            previous_status=old_status,
            new_status=new_status,
        )

    # Send status update emails
    if new_status == SellerApplicationStatus.UNDER_REVIEW:
        subject = f"OyoPasal Seller Application Under Review — {application.application_number}"
        body = (
            f"Hello {application.full_name},\n\n"
            f"Your application for '{application.business_name}' (Reference: {application.application_number}) "
            f"is currently being reviewed by our verification team.\n\n"
            f"We will notify you immediately once the review is completed.\n\n"
            f"Regards,\nOyoPasal Merchant Onboarding Team"
        )
        send_seller_email(application.email, subject, body)

    elif new_status == SellerApplicationStatus.REJECTED:
        subject = f"Update regarding your OyoPasal Seller Application — {application.application_number}"
        body = (
            f"Hello {application.full_name},\n\n"
            f"Thank you for your interest in selling on OyoPasal. After careful review, we regret to inform you that your application "
            f"for '{application.business_name}' could not be approved at this time.\n\n"
            f"Reason:\n{rejection_reason or 'Details provided did not meet our verification guidelines.'}\n\n"
            f"If you have questions or would like to submit corrected documentation, please contact merchant support at sellers@oyopasal.com.\n\n"
            f"Regards,\nOyoPasal Merchant Team"
        )
        send_seller_email(application.email, subject, body)

    elif additional_info:
        subject = f"Additional Information Needed — OyoPasal Seller Application {application.application_number}"
        body = (
            f"Hello {application.full_name},\n\n"
            f"Our team is reviewing your application for '{application.business_name}'. Before we can approve your store, "
            f"we need the following additional information or document updates:\n\n"
            f"{additional_info}\n\n"
            f"Please track your application at https://oyopasal.com/seller/track and reply with the required details.\n\n"
            f"Regards,\nOyoPasal Verification Team"
        )
        send_seller_email(application.email, subject, body)

    return application


def admin_approve_and_invite(
    application: SellerApplication,
    admin_user: User,
    frontend_base_url: str = 'http://127.0.0.1:3000'
) -> dict:
    """
    Approves the seller application, associates/creates the user and vendor profile,
    and issues a secure, single-use activation invitation token.
    """
    with transaction.atomic():
        # Check if user already exists with this email or applicant_user
        user = None
        if application.applicant_user and application.applicant_user.email.strip().lower() == application.email.strip().lower():
            user = application.applicant_user
        if not user:
            user = User.objects.filter(email__iexact=application.email.strip()).first()
        if not user:
            # Create user account with role VENDOR and unusable password until activation
            user = User.objects.create_user(
                email=application.email.strip().lower(),
                phone_number=application.phone.strip() if not User.objects.filter(phone_number=application.phone.strip()).exists() else None,
                first_name=application.full_name.split()[0] if application.full_name else 'Vendor',
                last_name=' '.join(application.full_name.split()[1:]) if ' ' in application.full_name else 'Partner',
                role=UserRole.VENDOR,
                is_active=True,
                is_verified=True,
            )
        else:
            # Associate existing customer account with application
            if not application.applicant_user:
                application.applicant_user = user
                application.save(update_fields=['applicant_user'])

        # Prepare or retrieve VendorProfile
        vp = getattr(user, 'vendor_profile', None)
        if not vp:
            b_name = application.business_name.strip()
            # Ensure unique business name
            existing_vp = VendorProfile.objects.filter(business_name__iexact=b_name).first()
            if existing_vp and existing_vp.user != user:
                b_name = f"{b_name} ({application.application_number[-4:]})"

            from django.utils.text import slugify
            base_slug = slugify(b_name) or 'store'
            slug = base_slug
            counter = 1
            while VendorProfile.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1

            vp = VendorProfile.objects.create(
                user=user,
                business_name=b_name,
                slug=slug,
                pan_vat_number=application.pan_vat_number,
                registration_number=application.registration_number,
                business_category=application.business_category,
                store_description=application.business_description,
                status=VendorStatus.PENDING,  # Remains PENDING until invitation is consumed & activated
                logo_url=application.logo_url,
            )

        # Prepare Store record linked to VendorProfile
        store = vp.stores.first()
        if not store:
            store = Store.objects.create(
                vendor=vp,
                name=vp.business_name,
                description=application.business_description,
                contact_email=application.business_contact_email or application.email,
                contact_phone=application.business_contact_phone or application.phone,
                address=application.complete_address,
                is_active=True,
                is_verified=False,  # Verified upon activation
            )

        # Invalidate any old unused invitations
        application.invitations.filter(is_used=False).update(is_used=True)

        # Generate single-use invitation token (valid for 7 days)
        token = secrets.token_urlsafe(32)
        expires_at = timezone.now() + timedelta(days=7)

        invitation = VendorInvitation.objects.create(
            application=application,
            token=token,
            email=application.email,
            expires_at=expires_at,
            created_by=admin_user,
        )

        # Update application state
        application.status = SellerApplicationStatus.INVITATION_SENT
        application.vendor_profile = vp
        application.reviewed_by = admin_user
        application.reviewed_at = timezone.now()
        application.save()

        SellerApplicationAudit.objects.create(
            application=application,
            action='APPROVED_AND_INVITED',
            actor=admin_user,
            notes=f"Approved by {admin_user.email}. Single-use activation token generated.",
            previous_status=application.status,
            new_status=SellerApplicationStatus.INVITATION_SENT,
        )

    # Send Invitation Email
    clean_base = frontend_base_url.rstrip('/')
    activation_url = f"{clean_base}/vendor/activate?token={token}"

    subject = f"Congratulations! Your OyoPasal Store Has Been Approved — Activate Account"
    body = (
        f"Dear {application.full_name},\n\n"
        f"Congratulations! Your application to become a seller on OyoPasal for '{application.business_name}' "
        f"has been approved by our administration team!\n\n"
        f"To complete your onboarding and access your Vendor Dashboard, please activate your account and create your password using this secure link:\n\n"
        f"{activation_url}\n\n"
        f"Note: This secure link is single-use and will expire in 7 days.\n\n"
        f"If you need any assistance, our Merchant Support Team is ready to help at sellers@oyopasal.com or +977 01-5970000.\n\n"
        f"Welcome to the OyoPasal Merchant Network!\n"
        f"OyoPasal Partner Onboarding Team\n"
    )
    send_seller_email(application.email, subject, body)

    return {
        'success': True,
        'message': f"Application {application.application_number} approved and activation invitation sent to {application.email}.",
        'application_number': application.application_number,
        'invitation_token': token,
        'activation_url': activation_url,
        'expires_at': expires_at,
    }


def admin_resend_invitation(
    application: SellerApplication,
    admin_user: User,
    frontend_base_url: str = 'http://127.0.0.1:3000'
) -> dict:
    """Resends a new active activation invitation token to the applicant."""
    with transaction.atomic():
        # Invalidate old unused invitations
        application.invitations.filter(is_used=False).update(is_used=True)

        token = secrets.token_urlsafe(32)
        expires_at = timezone.now() + timedelta(days=7)

        invitation = VendorInvitation.objects.create(
            application=application,
            token=token,
            email=application.email,
            expires_at=expires_at,
            created_by=admin_user,
        )

        application.status = SellerApplicationStatus.INVITATION_SENT
        application.save()

        SellerApplicationAudit.objects.create(
            application=application,
            action='INVITATION_RESENT',
            actor=admin_user,
            notes=f"New invitation token generated and resent by {admin_user.email}.",
            previous_status=application.status,
            new_status=SellerApplicationStatus.INVITATION_SENT,
        )

    clean_base = frontend_base_url.rstrip('/')
    activation_url = f"{clean_base}/vendor/activate?token={token}"

    subject = f"Your OyoPasal Merchant Activation Link (Resent)"
    body = (
        f"Hello {application.full_name},\n\n"
        f"As requested, here is your secure activation link to set your merchant password for '{application.business_name}':\n\n"
        f"{activation_url}\n\n"
        f"This link expires in 7 days.\n\n"
        f"Regards,\nOyoPasal Merchant Support Team"
    )
    send_seller_email(application.email, subject, body)

    return {
        'success': True,
        'message': f"Invitation resent to {application.email}.",
        'invitation_token': token,
        'activation_url': activation_url,
        'expires_at': expires_at,
    }


def verify_invitation_token(token: str) -> dict:
    """Validates an activation token without consuming it."""
    if not token or not isinstance(token, str):
        raise ValidationError({'detail': 'An activation token must be provided.', 'code': 'MISSING_TOKEN'})

    invitation = VendorInvitation.objects.filter(token=token.strip()).select_related('application').first()
    if not invitation:
        raise ValidationError({'detail': 'This activation link is invalid.', 'code': 'INVALID_TOKEN'})

    if invitation.is_used:
        raise ValidationError({
            'detail': 'This invitation link has already been used. Please log in directly with your password.',
            'code': 'TOKEN_ALREADY_USED'
        })

    if not invitation.is_valid():
        raise ValidationError({
            'detail': 'This invitation link has expired. Please contact support or request a new invitation.',
            'code': 'TOKEN_EXPIRED'
        })

    app = invitation.application
    return {
        'valid': True,
        'email': invitation.email,
        'business_name': app.business_name,
        'application_number': app.application_number,
        'full_name': app.full_name,
        'expires_at': invitation.expires_at,
    }


def activate_vendor_account(token: str, password: str) -> dict:
    """
    Consumes the activation token, sets the vendor's password,
    activates the VendorProfile and Store, and generates JWT tokens.
    """
    if not password or len(password) < 6:
        raise ValidationError({'password': 'Password must be at least 6 characters long.'})

    with transaction.atomic():
        # Lock invitation row to prevent race conditions
        invitation = VendorInvitation.objects.select_for_update().filter(token=token.strip()).select_related('application').first()
        if not invitation:
            raise ValidationError({'detail': 'Invalid activation token.', 'code': 'INVALID_TOKEN'})

        if invitation.is_used:
            raise ValidationError({
                'detail': 'This activation token has already been consumed. Please sign in directly.',
                'code': 'TOKEN_ALREADY_USED'
            })

        if not invitation.is_valid():
            raise ValidationError({'detail': 'This activation token has expired.', 'code': 'TOKEN_EXPIRED'})

        app = invitation.application
        user = User.objects.filter(email__iexact=invitation.email).first()
        if not user:
            user = User.objects.create_user(
                email=invitation.email.lower(),
                first_name=app.full_name.split()[0] if app.full_name else 'Vendor',
                last_name=' '.join(app.full_name.split()[1:]) if ' ' in app.full_name else 'Partner',
                role=UserRole.VENDOR,
                is_active=True,
                is_verified=True,
            )

        # Set user password and activate
        user.set_password(password)
        user.role = UserRole.VENDOR if user.role == UserRole.CUSTOMER else user.role
        user.is_active = True
        user.is_verified = True
        user.save()

        # Activate VendorProfile
        vp = getattr(user, 'vendor_profile', None)
        if not vp:
            from django.utils.text import slugify
            base_slug = slugify(app.business_name) or 'store'
            slug = base_slug
            counter = 1
            while VendorProfile.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1

            vp = VendorProfile.objects.create(
                user=user,
                business_name=app.business_name,
                slug=slug,
                pan_vat_number=app.pan_vat_number,
                registration_number=app.registration_number,
                business_category=app.business_category,
                store_description=app.business_description,
                status=VendorStatus.APPROVED,
                logo_url=app.logo_url,
            )
        else:
            vp.status = VendorStatus.APPROVED
            vp.save(update_fields=['status'])

        # Activate Store
        store = vp.stores.first()
        if store:
            store.is_verified = True
            store.is_active = True
            store.save(update_fields=['is_verified', 'is_active'])
        else:
            Store.objects.create(
                vendor=vp,
                name=vp.business_name,
                description=app.business_description,
                contact_email=app.business_contact_email or app.email,
                contact_phone=app.business_contact_phone or app.phone,
                address=app.complete_address,
                is_active=True,
                is_verified=True,
            )

        # Mark invitation as consumed
        invitation.is_used = True
        invitation.used_at = timezone.now()
        invitation.save(update_fields=['is_used', 'used_at'])

        # Mark application as ACTIVE
        app.status = SellerApplicationStatus.ACTIVE
        app.vendor_profile = vp
        app.save(update_fields=['status', 'vendor_profile'])

        # Record audit log
        SellerApplicationAudit.objects.create(
            application=app,
            action='ACTIVATED',
            actor=user,
            notes='Merchant account activated and password initialized by applicant.',
            previous_status=SellerApplicationStatus.INVITATION_SENT,
            new_status=SellerApplicationStatus.ACTIVE,
        )

    # Send confirmation email
    subject = f"Your OyoPasal Merchant Account is Now Active — {app.business_name}"
    body = (
        f"Hello {app.full_name},\n\n"
        f"Your merchant account for '{app.business_name}' has been successfully activated!\n"
        f"You can now log in to the OyoPasal Vendor Portal at https://oyopasal.com/seller using your email: {user.email}\n\n"
        f"Welcome aboard,\nOyoPasal Merchant Operations Team"
    )
    send_seller_email(user.email, subject, body)

    # Issue JWT tokens for seamless immediate login
    from rest_framework_simplejwt.tokens import RefreshToken
    refresh = RefreshToken.for_user(user)
    from apps.accounts.serializers import UserDetailSerializer
    user_data = UserDetailSerializer(user).data

    vendor_data = {
        'id': str(vp.id),
        'name': vp.business_name,
        'business_name': vp.business_name,
        'status': 'APPROVED',
        'approval_status': 'approved',
        'is_approved': True,
        'is_verified': True,
        'slug': vp.slug,
    }
    user_data['vendor'] = vendor_data
    user_data['has_vendor_access'] = True
    user_data['is_vendor'] = True

    return {
        'success': True,
        'message': 'Vendor account activated successfully! You can now access your seller dashboard.',
        'access': str(refresh.access_token),
        'token': str(refresh.access_token),
        'refresh': str(refresh),
        'user': user_data,
        'vendor': vendor_data,
    }
