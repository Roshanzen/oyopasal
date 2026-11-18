from rest_framework import serializers
from apps.suppliers.models import SupplierProfile, SupplierDocument

class SupplierDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierDocument
        fields = ('id', 'document_type', 'document_url', 'is_verified', 'verified_at', 'created_at')
        read_only_fields = ('id', 'is_verified', 'verified_at', 'created_at')


class SupplierProfileSerializer(serializers.ModelSerializer):
    documents = SupplierDocumentSerializer(many=True, read_only=True)

    class Meta:
        model = SupplierProfile
        fields = (
            'id', 'company_name', 'slug', 'pan_vat_number', 'registration_number',
            'wholesale_categories', 'company_description', 'status', 'rejection_reason',
            'credit_terms_days', 'minimum_po_amount', 'bank_name', 'bank_account_name',
            'bank_account_number', 'bank_branch', 'logo_url', 'documents', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'slug', 'status', 'rejection_reason', 'created_at', 'updated_at')


class SupplierCatalogOverviewSerializer(serializers.Serializer):
    total_products = serializers.IntegerField()
    active_products = serializers.IntegerField()


class SupplierQuotationsOverviewSerializer(serializers.Serializer):
    total_rfqs_received = serializers.IntegerField()
    pending_rfqs = serializers.IntegerField()
    submitted_quotes = serializers.IntegerField()
    accepted_quotes = serializers.IntegerField()


class SupplierOrdersOverviewSerializer(serializers.Serializer):
    total_purchase_orders = serializers.IntegerField()
    pending_pos = serializers.IntegerField()
    dispatched_pos = serializers.IntegerField()
    delivered_pos = serializers.IntegerField()
    total_wholesale_sales = serializers.CharField()


class SupplierInvoicesOverviewSerializer(serializers.Serializer):
    unpaid_invoices_count = serializers.IntegerField()
    unpaid_invoices_amount = serializers.CharField()
    paid_invoices_count = serializers.IntegerField()
    paid_invoices_amount = serializers.CharField()


class SupplierTopVendorSerializer(serializers.Serializer):
    vendor_id = serializers.CharField()
    business_name = serializers.CharField()
    total_spent = serializers.CharField()
    orders_count = serializers.IntegerField()


class SupplierDashboardOverviewResponseSerializer(serializers.Serializer):
    catalog = SupplierCatalogOverviewSerializer()
    quotations = SupplierQuotationsOverviewSerializer()
    orders = SupplierOrdersOverviewSerializer()
    invoices = SupplierInvoicesOverviewSerializer()
    top_vendors = SupplierTopVendorSerializer(many=True)


class SupplierVerificationSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['APPROVED', 'REJECTED'])
    rejection_reason = serializers.CharField(required=False, allow_blank=True)


class SupplierStaffMemberSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)

    class Meta:
        from apps.suppliers.models import SupplierStaffMember
        model = SupplierStaffMember
        fields = (
            'id', 'user', 'user_email', 'first_name', 'last_name',
            'can_manage_catalogue', 'can_manage_quotations', 'can_fulfill_orders',
            'can_view_financials', 'created_at'
        )
        read_only_fields = ('id', 'user_email', 'first_name', 'last_name', 'created_at')


