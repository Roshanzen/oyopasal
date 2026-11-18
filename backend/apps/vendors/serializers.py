from rest_framework import serializers
from apps.vendors.models import VendorProfile, VendorDocument

class VendorDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = VendorDocument
        fields = ('id', 'document_type', 'document_url', 'is_verified', 'verified_at', 'created_at')
        read_only_fields = ('id', 'is_verified', 'verified_at', 'created_at')


class VendorProfileSerializer(serializers.ModelSerializer):
    documents = VendorDocumentSerializer(many=True, read_only=True)
    store = serializers.SerializerMethodField()
    stores = serializers.SerializerMethodField()

    class Meta:
        model = VendorProfile
        fields = (
            'id', 'business_name', 'slug', 'pan_vat_number', 'registration_number',
            'business_category', 'store_description', 'status', 'rejection_reason',
            'commission_rate_override', 'bank_name', 'bank_account_name',
            'bank_account_number', 'bank_branch', 'logo_url', 'banner_url',
            'documents', 'store', 'stores', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'slug', 'status', 'rejection_reason', 'commission_rate_override', 'store', 'stores', 'created_at', 'updated_at')

    def get_store(self, obj):
        from apps.stores.models import Store
        from apps.stores.serializers import StoreDetailSerializer
        store = obj.stores.filter(is_active=True).first() or obj.stores.first()
        if not store:
            from django.utils.text import slugify
            base_slug = slugify(obj.business_name) or f"store-{str(obj.id)[:8]}"
            slug = base_slug
            counter = 1
            while Store.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            store = Store.objects.create(
                vendor=obj,
                name=obj.business_name,
                slug=slug,
                description=obj.store_description or f"Official storefront of {obj.business_name}",
                contact_email=getattr(obj.user, 'email', ''),
                is_active=True,
                is_verified=False
            )
        return StoreDetailSerializer(store).data

    def get_stores(self, obj):
        from apps.stores.serializers import StoreDetailSerializer
        return StoreDetailSerializer(obj.stores.all(), many=True).data


class VendorOverviewSalesSerializer(serializers.Serializer):
    today_sales = serializers.CharField()
    yesterday_sales = serializers.CharField()
    week_sales = serializers.CharField()
    month_sales = serializers.CharField()
    total_sales = serializers.CharField()
    average_order_value = serializers.CharField()


class VendorOverviewOrdersSerializer(serializers.Serializer):
    total_orders = serializers.IntegerField()
    today_orders = serializers.IntegerField()
    pending_orders = serializers.IntegerField()
    in_transit_orders = serializers.IntegerField()
    delivered_orders = serializers.IntegerField()
    cancelled_orders = serializers.IntegerField()


class VendorOverviewProductsSerializer(serializers.Serializer):
    total_products = serializers.IntegerField()
    active_products = serializers.IntegerField()
    out_of_stock_products = serializers.IntegerField()
    low_stock_products = serializers.IntegerField()


class VendorOverviewFinancialsSerializer(serializers.Serializer):
    platform_commission = serializers.CharField()
    vendor_net_earnings = serializers.CharField()
    pending_settlements = serializers.CharField()
    completed_settlements = serializers.CharField()


class VendorDashboardOverviewResponseSerializer(serializers.Serializer):
    sales = VendorOverviewSalesSerializer()
    orders = VendorOverviewOrdersSerializer()
    products = VendorOverviewProductsSerializer()
    financials = VendorOverviewFinancialsSerializer()


class VendorStaffMemberSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)

    class Meta:
        from apps.vendors.models import VendorStaffMember
        model = VendorStaffMember
        fields = (
            'id', 'user', 'user_email', 'first_name', 'last_name',
            'can_manage_products', 'can_manage_orders', 'can_manage_inventory',
            'can_view_settlements', 'can_manage_staff', 'created_at'
        )
        read_only_fields = ('id', 'user_email', 'first_name', 'last_name', 'created_at')


class VendorKYCVerificationSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['APPROVED', 'REJECTED'])
    rejection_reason = serializers.CharField(required=False, allow_blank=True)


class VendorSalesTrendItemSerializer(serializers.Serializer):
    date = serializers.CharField()
    gross_sales = serializers.CharField()
    net_earnings = serializers.CharField()
    order_count = serializers.IntegerField()


class VendorTopProductItemSerializer(serializers.Serializer):
    product_id = serializers.CharField()
    product_name = serializers.CharField()
    units_sold = serializers.IntegerField()
    revenue = serializers.CharField()


class PublicVendorSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='business_name')
    rating = serializers.SerializerMethodField()
    delivery_time_mins = serializers.SerializerMethodField()
    verified = serializers.SerializerMethodField()
    approval_status = serializers.SerializerMethodField()
    is_online = serializers.SerializerMethodField()
    description = serializers.CharField(source='store_description', default='')
    distance_km = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    cover_image_url = serializers.CharField(source='banner_url', default='')
    tags = serializers.SerializerMethodField()
    lat = serializers.SerializerMethodField()
    lng = serializers.SerializerMethodField()

    class Meta:
        model = VendorProfile
        fields = (
            'id', 'name', 'slug', 'rating', 'delivery_time_mins', 'verified',
            'approval_status', 'is_online', 'description', 'distance_km',
            'location', 'image', 'logo_url', 'cover_image_url', 'tags', 'lat', 'lng'
        )

    def get_rating(self, obj):
        return 4.8

    def get_delivery_time_mins(self, obj):
        return '10-15 mins'

    def get_verified(self, obj):
        return obj.status == 'APPROVED'

    def get_approval_status(self, obj):
        return obj.status.lower()

    def get_is_online(self, obj):
        return True

    def get_distance_km(self, obj):
        return 0.8

    def get_location(self, obj):
        store = obj.stores.first() if hasattr(obj, 'stores') else None
        if store and store.address:
            return store.address
        return obj.business_category or 'Kathmandu'

    def get_image(self, obj):
        return obj.logo_url or obj.banner_url or '/src/assets/images/promo_fresh_produce_1794407354982.jpg'

    def get_tags(self, obj):
        if obj.business_category:
            return [t.strip() for t in obj.business_category.split(',') if t.strip()]
        return ['Organic', 'Farm Fresh', 'Fast Delivery']

    def get_lat(self, obj):
        store = obj.stores.first() if hasattr(obj, 'stores') else None
        return float(store.latitude) if store and store.latitude else 27.7033

    def get_lng(self, obj):
        store = obj.stores.first() if hasattr(obj, 'stores') else None
        return float(store.longitude) if store and store.longitude else 85.3120


