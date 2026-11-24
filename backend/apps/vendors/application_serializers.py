from rest_framework import serializers
from apps.vendors.models import (
    SellerApplication,
    SellerApplicationStatus,
    SellerApplicationAudit,
    VendorInvitation,
)


class SellerApplicationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SellerApplication
        fields = [
            'full_name',
            'email',
            'phone',
            'alt_phone',
            'business_name',
            'business_category',
            'business_description',
            'business_contact_phone',
            'business_contact_email',
            'registration_number',
            'pan_vat_number',
            'province',
            'district',
            'municipality',
            'ward_number',
            'complete_address',
            'postal_code',
            'registration_doc_url',
            'pan_vat_doc_url',
            'logo_url',
            'supporting_docs',
            'declaration_confirmed',
        ]

    def validate_email(self, value):
        return value.strip().lower()

    def validate_declaration_confirmed(self, value):
        if not value:
            raise serializers.ValidationError("You must confirm that submitted information is accurate and agree to seller terms.")
        return value


class SellerApplicationTrackSerializer(serializers.Serializer):
    application_number = serializers.CharField(max_length=64, required=True)
    email = serializers.EmailField(required=True)


class SellerApplicationAuditSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = SellerApplicationAudit
        fields = [
            'id',
            'action',
            'actor_name',
            'notes',
            'previous_status',
            'new_status',
            'created_at',
        ]

    def get_actor_name(self, obj):
        if not obj.actor:
            return 'System'
        return obj.actor.full_name or obj.actor.email


class SellerApplicationListSerializer(serializers.ModelSerializer):
    class Meta:
        model = SellerApplication
        fields = [
            'id',
            'application_number',
            'full_name',
            'email',
            'phone',
            'business_name',
            'business_category',
            'province',
            'district',
            'status',
            'created_at',
            'reviewed_at',
        ]


class SellerApplicationDetailSerializer(serializers.ModelSerializer):
    audit_logs = SellerApplicationAuditSerializer(many=True, read_only=True)
    reviewed_by_email = serializers.SerializerMethodField()

    class Meta:
        model = SellerApplication
        fields = '__all__'

    def get_reviewed_by_email(self, obj):
        return obj.reviewed_by.email if obj.reviewed_by else None


class AdminApplicationStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=SellerApplicationStatus.choices, required=False)
    notes = serializers.CharField(required=False, allow_blank=True)
    rejection_reason = serializers.CharField(required=False, allow_blank=True)
    additional_info = serializers.CharField(required=False, allow_blank=True)


class VendorActivationSubmitSerializer(serializers.Serializer):
    token = serializers.CharField(required=True)
    password = serializers.CharField(min_length=6, write_only=True, required=True)
    confirm_password = serializers.CharField(min_length=6, write_only=True, required=False)

    def validate(self, attrs):
        pw = attrs.get('password')
        cpw = attrs.get('confirm_password')
        if cpw and pw != cpw:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        return attrs
