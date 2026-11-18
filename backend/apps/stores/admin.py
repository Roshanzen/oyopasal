from django.contrib import admin
from apps.stores.models import Store

@admin.register(Store)
class StoreAdmin(admin.ModelAdmin):
    list_display = ('name', 'vendor', 'slug', 'is_active', 'is_verified', 'created_at')
    list_filter = ('is_active', 'is_verified')
    search_fields = ('name', 'vendor__business_name', 'contact_email', 'contact_phone')
    prepopulated_fields = {'slug': ('name',)}

