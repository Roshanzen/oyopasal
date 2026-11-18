from django.contrib import admin
from apps.customers.models import CustomerProfile, Address

class AddressInline(admin.StackedInline):
    model = Address
    extra = 0

@admin.register(CustomerProfile)
class CustomerProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'gender', 'loyalty_points', 'is_phone_verified', 'created_at')
    search_fields = ('user__email', 'user__first_name', 'user__last_name')
    list_filter = ('gender', 'is_phone_verified')
    inlines = [AddressInline]

@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ('recipient_name', 'recipient_phone', 'province', 'district', 'municipality', 'ward_number', 'is_default_shipping')
    search_fields = ('recipient_name', 'recipient_phone', 'district', 'tole_street')
    list_filter = ('province', 'is_default_shipping')

