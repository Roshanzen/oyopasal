from rest_framework import serializers
from .models import CustomerProfile, Address, NepalProvince
from apps.accounts.serializers import UserDetailSerializer

class AddressSerializer(serializers.ModelSerializer):
    province_display = serializers.CharField(source='get_province_display', read_only=True)

    class Meta:
        model = Address
        fields = [
            'id',
            'recipient_name',
            'recipient_phone',
            'province',
            'province_display',
            'district',
            'municipality',
            'ward_number',
            'tole_street',
            'landmark',
            'postal_code',
            'latitude',
            'longitude',
            'is_default_shipping',
            'is_default_billing',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_ward_number(self, value):
        if value < 1 or value > 35:
            raise serializers.ValidationError("Ward number must be between 1 and 35.")
        return value


class CustomerProfileSerializer(serializers.ModelSerializer):
    user = UserDetailSerializer(read_only=True)
    addresses = AddressSerializer(many=True, read_only=True)

    class Meta:
        model = CustomerProfile
        fields = [
            'id',
            'user',
            'date_of_birth',
            'gender',
            'loyalty_points',
            'is_phone_verified',
            'addresses',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'user', 'loyalty_points', 'is_phone_verified', 'created_at', 'updated_at']
