from rest_framework import serializers
from .models import SupportTicket, TicketMessage

class TicketMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    sender_email = serializers.EmailField(source='sender.email', read_only=True)

    class Meta:
        model = TicketMessage
        fields = [
            'id',
            'ticket',
            'sender',
            'sender_name',
            'sender_email',
            'message',
            'attachment_url',
            'is_staff_reply',
            'created_at',
        ]
        read_only_fields = ['id', 'ticket', 'sender', 'is_staff_reply', 'created_at']

    def get_sender_name(self, obj):
        name = f"{getattr(obj.sender, 'first_name', '')} {getattr(obj.sender, 'last_name', '')}".strip()
        return name if name else obj.sender.email


class SupportTicketSerializer(serializers.ModelSerializer):
    messages = TicketMessageSerializer(many=True, read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)
    related_order_number = serializers.CharField(source='related_order.order_number', read_only=True)

    class Meta:
        model = SupportTicket
        fields = [
            'id',
            'ticket_number',
            'user',
            'user_email',
            'subject',
            'category',
            'priority',
            'status',
            'related_order',
            'related_order_number',
            'assigned_to',
            'messages',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'ticket_number', 'user', 'assigned_to', 'created_at', 'updated_at']


class CreateTicketSerializer(serializers.ModelSerializer):
    initial_message = serializers.CharField(write_only=True)

    class Meta:
        model = SupportTicket
        fields = [
            'subject',
            'category',
            'priority',
            'related_order',
            'initial_message',
        ]


class CreateMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketMessage
        fields = ['message', 'attachment_url']

