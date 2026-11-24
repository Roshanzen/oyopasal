from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, NotFound, ValidationError
from drf_spectacular.utils import extend_schema, OpenApiParameter

from apps.messaging.models import Conversation, Message
from apps.messaging.serializers import (
    ConversationListSerializer,
    ConversationDetailSerializer,
    MessageSerializer,
    MessageCreateSerializer,
    InitiateConversationSerializer,
)
from apps.stores.models import Store
from apps.vendors.models import VendorProfile
from apps.catalogue.models import Product
from apps.common.utils import is_valid_uuid


def get_user_vendor(user):
    """Safely retrieves the VendorProfile associated with user (as owner or authorized staff)."""
    if hasattr(user, 'vendor_profile'):
        return user.vendor_profile
    staff = user.vendor_staff_roles.select_related('vendor').first()
    if staff:
        return staff.vendor
    return None


class InitiateConversationView(APIView):
    """
    POST: Find existing conversation or initiate a new one with a store/vendor.
    Prevents duplicate conversations between customer and vendor for the same store.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Initiate or Resume Customer-Vendor Conversation", request=InitiateConversationSerializer)
    def post(self, request):
        serializer = InitiateConversationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        store_id = serializer.validated_data['store_id']
        product_id = serializer.validated_data.get('product_id')
        initial_message = serializer.validated_data.get('initial_message', '').strip()

        # 1. Resolve Store and Vendor flexibly
        store = None
        vendor = None

        # A. Direct Store lookup by ID or slug
        if is_valid_uuid(store_id):
            store = Store.objects.filter(id=store_id, is_active=True).select_related('vendor').first()
        if not store:
            store = Store.objects.filter(slug=store_id, is_active=True).select_related('vendor').first()

        # B. Store lookup via linked Vendor (by vendor ID, slug, or vendor user ID)
        if not store:
            if is_valid_uuid(store_id):
                store = Store.objects.filter(
                    Q(vendor__id=store_id) | Q(vendor__user__id=store_id),
                    is_active=True
                ).select_related('vendor').first()
            if not store:
                store = Store.objects.filter(vendor__slug=store_id, is_active=True).select_related('vendor').first()

        # C. Name-based match on Store name or Vendor business name
        if not store:
            clean_name = store_id.replace('-', ' ').strip()
            store = Store.objects.filter(
                Q(name__iexact=store_id) | Q(name__iexact=clean_name) |
                Q(vendor__business_name__iexact=store_id) | Q(vendor__business_name__iexact=clean_name),
                is_active=True
            ).select_related('vendor').first()

        # D. Fallback: Find VendorProfile directly if store record was not found
        if store and store.vendor:
            vendor = store.vendor
        else:
            vendor_profile = None
            if is_valid_uuid(store_id):
                vendor_profile = VendorProfile.objects.filter(Q(id=store_id) | Q(user__id=store_id)).first()
            if not vendor_profile:
                vendor_profile = VendorProfile.objects.filter(slug=store_id).first()
            if not vendor_profile:
                clean_name = store_id.replace('-', ' ').strip()
                vendor_profile = VendorProfile.objects.filter(
                    Q(business_name__iexact=store_id) | Q(business_name__iexact=clean_name)
                ).first()

            if vendor_profile:
                vendor = vendor_profile
                # Find an existing store for this vendor or create/activate default store
                store = Store.objects.filter(vendor=vendor).first()
                if not store:
                    from django.utils.text import slugify
                    import uuid
                    base_slug = slugify(vendor.business_name) or 'store'
                    unique_slug = f"{base_slug}-{uuid.uuid4().hex[:4]}"
                    store = Store.objects.create(
                        vendor=vendor,
                        name=vendor.business_name,
                        slug=unique_slug,
                        description=vendor.description or f"Official store of {vendor.business_name}",
                        is_active=True,
                        is_verified=True,
                    )
                elif not store.is_active:
                    store.is_active = True
                    store.save(update_fields=['is_active'])

        if not store or not vendor:
            raise NotFound({"code": "STORE_NOT_FOUND", "message": "Store or vendor not found or is currently inactive."})

        # 2. Prevent vendor from messaging their own store
        vendor = store.vendor
        if vendor.user_id == request.user.id:
            return Response({
                "success": False,
                "code": "CANNOT_MESSAGE_OWN_STORE",
                "message": "You cannot start a customer conversation with your own store."
            }, status=status.HTTP_400_BAD_REQUEST)

        user_vendor = get_user_vendor(request.user)
        if user_vendor and user_vendor.id == vendor.id:
            return Response({
                "success": False,
                "code": "CANNOT_MESSAGE_OWN_STORE",
                "message": "Staff members cannot start customer conversations with their own store."
            }, status=status.HTTP_400_BAD_REQUEST)

        # 3. Optional Product context
        product = None
        if product_id:
            if is_valid_uuid(product_id):
                product = Product.objects.filter(id=product_id, is_deleted=False).first()
            if not product:
                product = Product.objects.filter(slug=product_id, is_deleted=False).first()

        # 4. Atomically find or create the unique conversation
        with transaction.atomic():
            conversation, created = Conversation.objects.select_for_update().get_or_create(
                customer=request.user,
                vendor=vendor,
                store=store,
                defaults={
                    'product': product,
                    'last_message_at': timezone.now(),
                    'last_message_preview': initial_message[:100] if initial_message else 'Started conversation',
                    'last_message_sender_role': 'CUSTOMER' if initial_message else '',
                    'customer_unread_count': 0,
                    'vendor_unread_count': 1 if initial_message else 0,
                }
            )

            # If existing conversation and product was provided, update context
            if not created and product and not conversation.product:
                conversation.product = product
                conversation.save(update_fields=['product', 'updated_at'])

            # Send initial message if provided and conversation was just created or active
            if initial_message:
                Message.objects.create(
                    conversation=conversation,
                    sender=request.user,
                    sender_role=Message.SenderRole.CUSTOMER,
                    content=initial_message
                )
                conversation.last_message_at = timezone.now()
                conversation.last_message_preview = initial_message[:100]
                conversation.last_message_sender_role = Message.SenderRole.CUSTOMER
                conversation.vendor_unread_count = conversation.vendor_unread_count + 1
                conversation.save(update_fields=[
                    'last_message_at', 'last_message_preview',
                    'last_message_sender_role', 'vendor_unread_count', 'updated_at'
                ])

        out_serializer = ConversationDetailSerializer(
            conversation,
            context={'request': request, 'as_role': 'customer'}
        )
        return Response({
            'success': True,
            'is_new': created,
            'message': "Conversation ready.",
            'conversation': out_serializer.data
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class ConversationListView(generics.ListAPIView):
    """
    GET: List active conversations for the authenticated user.
    Supports ?as_role=customer or ?as_role=vendor and ?q=search_query.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ConversationListSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['as_role'] = self.request.query_params.get('as_role', 'customer').lower()
        return ctx

    def get_queryset(self):
        user = self.request.user
        as_role = self.request.query_params.get('as_role', 'customer').lower()
        q = self.request.query_params.get('q', '').strip()

        if as_role == 'vendor':
            vendor = get_user_vendor(user)
            if not vendor:
                return Conversation.objects.none()
            qs = Conversation.objects.filter(
                vendor=vendor,
                is_deleted=False,
                is_archived_by_vendor=False
            )
        else:
            qs = Conversation.objects.filter(
                customer=user,
                is_deleted=False,
                is_archived_by_customer=False
            )

        if q:
            qs = qs.filter(
                Q(store__name__icontains=q) |
                Q(vendor__business_name__icontains=q) |
                Q(customer__first_name__icontains=q) |
                Q(customer__last_name__icontains=q) |
                Q(last_message_preview__icontains=q)
            )

        return qs.select_related('customer', 'vendor', 'store', 'product').order_by('-last_message_at')


class ConversationDetailView(APIView):
    """
    GET: Retrieve conversation details, verify participant authorization,
    and automatically mark incoming unread messages as read.
    """
    permission_classes = [IsAuthenticated]

    def get_conversation(self, pk, user):
        conversation = Conversation.objects.filter(id=pk, is_deleted=False).select_related(
            'customer', 'vendor', 'store', 'product'
        ).first()
        if not conversation:
            raise NotFound({"code": "NOT_FOUND", "message": "Conversation not found."})

        # Authorization check
        is_customer = (str(conversation.customer_id) == str(user.id))
        user_vendor = get_user_vendor(user)
        is_vendor = (user_vendor is not None and str(conversation.vendor_id) == str(user_vendor.id))

        if not is_customer and not is_vendor and not user.is_superuser:
            raise PermissionDenied({
                "code": "ACCESS_DENIED",
                "message": "You are not authorized to access this conversation."
            })

        return conversation, is_customer, is_vendor

    @extend_schema(summary="Get Conversation Detail and Mark Read")
    def get(self, request, pk):
        conversation, is_customer, is_vendor = self.get_conversation(pk, request.user)

        # Mark messages read for current reader
        now = timezone.now()
        if is_customer and conversation.customer_unread_count > 0:
            conversation.messages.filter(sender_role=Message.SenderRole.VENDOR, is_read=False).update(
                is_read=True, read_at=now
            )
            conversation.customer_unread_count = 0
            conversation.save(update_fields=['customer_unread_count', 'updated_at'])
        elif is_vendor and conversation.vendor_unread_count > 0:
            conversation.messages.filter(sender_role=Message.SenderRole.CUSTOMER, is_read=False).update(
                is_read=True, read_at=now
            )
            conversation.vendor_unread_count = 0
            conversation.save(update_fields=['vendor_unread_count', 'updated_at'])

        as_role = 'customer' if is_customer else 'vendor'
        serializer = ConversationDetailSerializer(
            conversation,
            context={'request': request, 'as_role': as_role}
        )
        return Response({
            'success': True,
            'conversation': serializer.data
        })


class ConversationMessagesView(APIView):
    """
    GET: Retrieve paginated messages for a conversation.
    POST: Send a new message into the conversation.
    """
    permission_classes = [IsAuthenticated]

    def get_conversation_and_role(self, pk, user):
        conversation = Conversation.objects.filter(id=pk, is_deleted=False).select_related('customer', 'vendor').first()
        if not conversation:
            raise NotFound({"code": "NOT_FOUND", "message": "Conversation not found."})

        is_customer = (str(conversation.customer_id) == str(user.id))
        user_vendor = get_user_vendor(user)
        is_vendor = (user_vendor is not None and str(conversation.vendor_id) == str(user_vendor.id))

        if not is_customer and not is_vendor and not user.is_superuser:
            raise PermissionDenied({
                "code": "ACCESS_DENIED",
                "message": "You are not authorized to access this conversation."
            })

        role = Message.SenderRole.CUSTOMER if is_customer else Message.SenderRole.VENDOR
        return conversation, role

    @extend_schema(summary="List Messages in Conversation")
    def get(self, request, pk):
        conversation, role = self.get_conversation_and_role(pk, request.user)
        
        # Pagination params
        limit = min(int(request.query_params.get('limit', 50)), 100)
        messages_qs = conversation.messages.filter(is_deleted=False).select_related('sender').order_by('created_at')[:limit]
        
        serializer = MessageSerializer(messages_qs, many=True, context={'request': request})
        return Response({
            'success': True,
            'count': len(serializer.data),
            'messages': serializer.data,
            'data': serializer.data,
            'results': serializer.data
        })

    @extend_schema(summary="Send Message in Conversation", request=MessageCreateSerializer)
    def post(self, request, pk):
        conversation, role = self.get_conversation_and_role(pk, request.user)

        serializer = MessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        content = serializer.validated_data['content']
        attachment_url = serializer.validated_data.get('attachment_url', '')

        with transaction.atomic():
            msg = Message.objects.create(
                conversation=conversation,
                sender=request.user,
                sender_role=role,
                content=content,
                attachment_url=attachment_url
            )

            now = timezone.now()
            conversation.last_message_at = now
            conversation.last_message_preview = content[:100]
            conversation.last_message_sender_role = role

            if role == Message.SenderRole.CUSTOMER:
                conversation.vendor_unread_count = conversation.vendor_unread_count + 1
            else:
                conversation.customer_unread_count = conversation.customer_unread_count + 1

            conversation.save(update_fields=[
                'last_message_at', 'last_message_preview',
                'last_message_sender_role', 'customer_unread_count',
                'vendor_unread_count', 'updated_at'
            ])

        out_serializer = MessageSerializer(msg, context={'request': request})
        return Response({
            'success': True,
            'message': "Message sent successfully.",
            'data': out_serializer.data
        }, status=status.HTTP_201_CREATED)


class ConversationMarkReadView(APIView):
    """
    POST: Explicitly mark all incoming messages as read in a conversation.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Mark Conversation as Read")
    def post(self, request, pk):
        conversation = Conversation.objects.filter(id=pk, is_deleted=False).first()
        if not conversation:
            raise NotFound({"code": "NOT_FOUND", "message": "Conversation not found."})

        user = request.user
        is_customer = (str(conversation.customer_id) == str(user.id))
        user_vendor = get_user_vendor(user)
        is_vendor = (user_vendor is not None and str(conversation.vendor_id) == str(user_vendor.id))

        if not is_customer and not is_vendor and not user.is_superuser:
            raise PermissionDenied({"code": "ACCESS_DENIED", "message": "Not authorized."})

        now = timezone.now()
        with transaction.atomic():
            if is_customer:
                conversation.messages.filter(sender_role=Message.SenderRole.VENDOR, is_read=False).update(
                    is_read=True, read_at=now
                )
                conversation.customer_unread_count = 0
                conversation.save(update_fields=['customer_unread_count', 'updated_at'])
            elif is_vendor:
                conversation.messages.filter(sender_role=Message.SenderRole.CUSTOMER, is_read=False).update(
                    is_read=True, read_at=now
                )
                conversation.vendor_unread_count = 0
                conversation.save(update_fields=['vendor_unread_count', 'updated_at'])

        return Response({'success': True, 'message': 'Conversation marked as read.'})


class UnreadMessagesCountView(APIView):
    """
    GET: Aggregate unread message counts for navbar badges and dashboard tabs.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Get Aggregate Unread Messages Count")
    def get(self, request):
        user = request.user
        # Customer unread
        cust_unread = Conversation.objects.filter(
            customer=user,
            is_deleted=False,
            is_archived_by_customer=False
        ).aggregate(total=Sum('customer_unread_count'))['total'] or 0

        # Vendor unread
        vendor = get_user_vendor(user)
        vend_unread = 0
        if vendor:
            vend_unread = Conversation.objects.filter(
                vendor=vendor,
                is_deleted=False,
                is_archived_by_vendor=False
            ).aggregate(total=Sum('vendor_unread_count'))['total'] or 0

        return Response({
            'success': True,
            'data': {
                'customer_unread': cust_unread,
                'vendor_unread': vend_unread,
                'total_unread': cust_unread + vend_unread
            }
        })
