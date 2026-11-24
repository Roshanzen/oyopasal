from django.contrib import admin
from apps.messaging.models import Conversation, Message


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    fields = ('sender', 'sender_role', 'content', 'is_read', 'created_at')
    readonly_fields = ('sender', 'sender_role', 'content', 'is_read', 'created_at')
    can_delete = False


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'customer', 'vendor', 'store',
        'last_message_at', 'customer_unread_count', 'vendor_unread_count',
        'is_deleted'
    )
    list_filter = ('is_deleted', 'last_message_at', 'created_at')
    search_fields = (
        'customer__email', 'customer__first_name', 'customer__last_name',
        'vendor__business_name', 'store__name', 'last_message_preview'
    )
    readonly_fields = (
        'customer', 'vendor', 'store', 'product',
        'last_message_at', 'last_message_preview', 'last_message_sender_role',
        'customer_unread_count', 'vendor_unread_count', 'created_at', 'updated_at'
    )
    inlines = [MessageInline]


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'conversation', 'sender', 'sender_role', 'is_read', 'created_at')
    list_filter = ('sender_role', 'is_read', 'created_at')
    search_fields = ('sender__email', 'content')
    readonly_fields = ('conversation', 'sender', 'sender_role', 'content', 'attachment_url', 'created_at', 'read_at')
