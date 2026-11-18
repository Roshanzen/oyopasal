from rest_framework import serializers
from .models import ProductReview

class ProductReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = ProductReview
        fields = [
            'id',
            'user',
            'user_name',
            'product',
            'rating',
            'title',
            'comment',
            'is_verified_purchase',
            'is_approved',
            'vendor_reply',
            'vendor_replied_at',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'user',
            'is_verified_purchase',
            'is_approved',
            'vendor_reply',
            'vendor_replied_at',
            'created_at',
        ]

    def get_user_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name[:1]}." if obj.user.last_name else obj.user.first_name


class CreateReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductReview
        fields = ['rating', 'title', 'comment']


class VendorReplyReviewSerializer(serializers.Serializer):
    reply = serializers.CharField(max_length=1000)

