from rest_framework import serializers
from .models import CustomerProfile, Address, NepalProvince
from apps.accounts.serializers import UserDetailSerializer

class AddressSerializer(serializers.ModelSerializer):
    province_display = serializers.CharField(source='get_province_display', read_only=True)

    class Meta:
        model = Address
        fields = [
            'id',
            'title',
            'recipient_name',
            'recipient_phone',
            'province',
            'province_display',
            'district',
            'municipality',
            'ward_number',
            'tole_street',
            'area',
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

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        # Map frontend alternate keys to backend model keys
        if 'phone' in data and not data.get('recipient_phone'):
            data['recipient_phone'] = str(data['phone'])
        if 'street' in data and not data.get('tole_street'):
            data['tole_street'] = str(data['street'])
        if 'city' in data and not data.get('district'):
            data['district'] = str(data['city'])
        if 'lat' in data and data.get('latitude') is None:
            data['latitude'] = data['lat']
        if 'lng' in data and data.get('longitude') is None:
            data['longitude'] = data['lng']
        if 'is_default' in data and 'is_default_shipping' not in data:
            data['is_default_shipping'] = bool(data['is_default'])

        # Set sensible defaults for any missing required fields
        if not data.get('recipient_name'):
            req = self.context.get('request')
            user = req.user if req and req.user and req.user.is_authenticated else None
            data['recipient_name'] = getattr(user, 'full_name', '') or getattr(user, 'email', '') or 'Customer'
        if not data.get('recipient_phone'):
            req = self.context.get('request')
            user = req.user if req and req.user and req.user.is_authenticated else None
            data['recipient_phone'] = getattr(user, 'phone_number', '') or '+977 9800000000'
        if not data.get('district'):
            data['district'] = 'Kathmandu'
        if not data.get('municipality'):
            data['municipality'] = data.get('area') or 'Kathmandu Metropolitan'
        if not data.get('ward_number'):
            data['ward_number'] = 1
        if not data.get('tole_street'):
            data['tole_street'] = data.get('area') or 'Main Road'
        if not data.get('title'):
            data['title'] = 'Home'

        return super().to_internal_value(data)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # Provide both frontend-friendly keys and backend model keys
        lat_val = float(instance.latitude) if instance.latitude is not None else None
        lng_val = float(instance.longitude) if instance.longitude is not None else None
        ret['title'] = instance.title or 'Home'
        ret['phone'] = instance.recipient_phone
        ret['street'] = instance.tole_street
        ret['area'] = instance.area or instance.municipality or 'Kathmandu'
        ret['city'] = instance.district or 'Kathmandu'
        ret['lat'] = lat_val
        ret['lng'] = lng_val
        ret['is_default'] = instance.is_default_shipping
        return ret

    def validate_ward_number(self, value):
        if value < 1 or value > 35:
            return 1
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
