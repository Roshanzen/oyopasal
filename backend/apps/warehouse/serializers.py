from rest_framework import serializers
from apps.warehouse.models import Warehouse

class WarehouseSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source='vendor.business_name', read_only=True)

    class Meta:
        model = Warehouse
        fields = [
            'id', 'vendor', 'vendor_name', 'name', 'code',
            'contact_person', 'contact_phone', 'province',
            'district', 'city', 'address_line', 'postal_code',
            'is_active', 'is_default', 'created_at'
        ]
        read_only_fields = ['id', 'vendor', 'created_at']

