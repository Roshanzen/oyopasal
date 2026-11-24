from rest_framework import serializers
from django.contrib.auth import get_user_model
from apps.messaging.models import Conversation, Message
from apps.stores.models import Store
from apps.catalogue.models import Product

User = get_user_model()


class MessageSerializer(serializers.ModelSerializer):
    """Serializer for individual chat messages."""
    conversation_id = serializers.UUIDField(source='conversation.id', read_only=True)
    sender_id = serializers.UUIDField(source='sender.id', read_only=True)
    sender_name = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id', 'conversation_id', 'sender_id', 'sender_name',
            'sender_role', 'content', 'attachment_url',
            'is_read', 'read_at', 'created_at', 'is_mine'
        ]
        read_only_fields = ['id', 'conversation_id', 'sender_id', 'sender_role', 'is_read', 'read_at', 'created_at']

    def get_sender_name(self, obj):
        first = getattr(obj.sender, 'first_name', '')
        last = getattr(obj.sender, 'last_name', '')
        full = f"{first} {last}".strip()
        if full:
            return full
        if obj.sender_role == 'VENDOR' and hasattr(obj.conversation, 'vendor'):
            return obj.conversation.vendor.business_name
        return obj.sender.email.split('@')[0] if obj.sender else 'User'

    def get_is_mine(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return str(obj.sender_id) == str(request.user.id)


class MessageCreateSerializer(serializers.ModelSerializer):
    """Validation serializer for sending a message."""
    content = serializers.CharField(max_length=2000, min_length=1, trim_whitespace=True)
    attachment_url = serializers.URLField(max_length=500, required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = Message
        fields = ['content', 'attachment_url']

    def validate_content(self, value):
        val = value.strip()
        if not val:
            raise serializers.ValidationError("Message content cannot be blank.")
        return val


class InitiateConversationSerializer(serializers.Serializer):
    """Request payload for starting or resuming a customer-vendor conversation."""
    store_id = serializers.CharField(required=True, help_text="Store UUID or Store slug")
    product_id = serializers.CharField(required=False, allow_blank=True, allow_null=True, help_text="Optional product context UUID or slug")
    initial_message = serializers.CharField(max_length=2000, required=False, allow_blank=True, trim_whitespace=True)


class ConversationListSerializer(serializers.ModelSerializer):
    """Serializer for conversation list in customer account and vendor dashboard."""
    store_name = serializers.CharField(source='store.name', read_only=True, default='')
    store_slug = serializers.CharField(source='store.slug', read_only=True, default='')
    store_logo_url = serializers.CharField(source='store.logo_url', read_only=True, default='')
    vendor_id = serializers.UUIDField(source='vendor.id', read_only=True)
    vendor_name = serializers.CharField(source='vendor.business_name', read_only=True)
    vendor_slug = serializers.CharField(source='vendor.slug', read_only=True)

    customer_id = serializers.UUIDField(source='customer.id', read_only=True)
    customer_name = serializers.SerializerMethodField()
    customer_avatar_url = serializers.SerializerMethodField()

    product_context = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    other_party = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'id', 'store_name', 'store_slug', 'store_logo_url',
            'vendor_id', 'vendor_name', 'vendor_slug',
            'customer_id', 'customer_name', 'customer_avatar_url',
            'product_context',
            'last_message_at', 'last_message_preview', 'last_message_sender_role',
            'unread_count', 'other_party'
        ]

    def get_customer_name(self, obj):
        first = getattr(obj.customer, 'first_name', '')
        last = getattr(obj.customer, 'last_name', '')
        full = f"{first} {last}".strip()
        return full if full else (obj.customer.email.split('@')[0] if obj.customer else 'Customer')

    def get_customer_avatar_url(self, obj):
        prof = getattr(obj.customer, 'customer_profile', None)
        return getattr(prof, 'avatar_url', '') if prof else ''

    def get_product_context(self, obj):
        if not obj.product:
            return None
        prod = obj.product
        first_img = None
        if hasattr(prod, 'images'):
            imgs = list(prod.images.all())
            first_img = next((im.image_url for im in imgs if im.is_primary), None) or (imgs[0].image_url if imgs else '')
        var = prod.variants.filter(is_active=True).first() if hasattr(prod, 'variants') else None
        return {
            'id': str(prod.id),
            'name': prod.name,
            'slug': prod.slug,
            'price': float(var.selling_price) if var else 0.0,
            'image_url': first_img or ''
        }

    def get_unread_count(self, obj):
        request = self.context.get('request')
        as_role = self.context.get('as_role')
        if not request or not request.user.is_authenticated:
            return 0
        if as_role == 'vendor':
            return obj.vendor_unread_count
        if as_role == 'customer':
            return obj.customer_unread_count
        # Auto-detect role
        if str(obj.customer_id) == str(request.user.id):
            return obj.customer_unread_count
        return obj.vendor_unread_count

    def get_other_party(self, obj):
        request = self.context.get('request')
        as_role = self.context.get('as_role')
        is_customer = False
        if as_role == 'customer':
            is_customer = True
        elif as_role == 'vendor':
            is_customer = False
        elif request and request.user.is_authenticated:
            is_customer = (str(obj.customer_id) == str(request.user.id))

        if is_customer:
            # Customer is viewing: other party is the Store / Vendor
            st_name = obj.store.name if obj.store else obj.vendor.business_name
            logo = obj.store.logo_url if (obj.store and obj.store.logo_url) else ''
            return {
                'id': str(obj.vendor.id),
                'name': st_name,
                'subtitle': f"Verified Vendor • {obj.vendor.business_name}",
                'avatar_url': logo,
                'role': 'VENDOR',
                'store_slug': obj.store.slug if obj.store else obj.vendor.slug
            }
        else:
            # Vendor is viewing: other party is Customer
            c_name = self.get_customer_name(obj)
            return {
                'id': str(obj.customer.id),
                'name': c_name,
                'subtitle': 'Verified Customer',
                'avatar_url': self.get_customer_avatar_url(obj),
                'role': 'CUSTOMER'
            }


class ConversationDetailSerializer(ConversationListSerializer):
    """Detailed conversation serializer with embedded recent messages."""
    recent_messages = serializers.SerializerMethodField()

    class Meta(ConversationListSerializer.Meta):
        fields = ConversationListSerializer.Meta.fields + ['recent_messages']

    def get_recent_messages(self, obj):
        # Fetch the last 50 messages ordered chronologically
        qs = obj.messages.filter(is_deleted=False).select_related('sender').order_by('created_at')[:50]
        return MessageSerializer(qs, many=True, context=self.context).data
