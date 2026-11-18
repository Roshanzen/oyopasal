from rest_framework import serializers

class BusinessKPISerializer(serializers.Serializer):
    total_vendors = serializers.IntegerField()
    active_vendors = serializers.IntegerField()
    pending_vendors = serializers.IntegerField()
    suspended_vendors = serializers.IntegerField()
    total_suppliers = serializers.IntegerField()
    active_suppliers = serializers.IntegerField()
    pending_suppliers = serializers.IntegerField()
    total_customers = serializers.IntegerField()
    new_customers_today = serializers.IntegerField()
    total_stores = serializers.IntegerField()
    active_stores = serializers.IntegerField()
    total_products = serializers.IntegerField()
    approved_products = serializers.IntegerField()
    pending_products = serializers.IntegerField()
    rejected_products = serializers.IntegerField()
    low_stock_items = serializers.IntegerField()


class SalesKPISerializer(serializers.Serializer):
    today_gross_sales = serializers.CharField()
    yesterday_gross_sales = serializers.CharField()
    month_gross_sales = serializers.CharField()
    total_gmv = serializers.CharField()
    today_orders_count = serializers.IntegerField()
    all_time_orders_count = serializers.IntegerField()
    average_order_value = serializers.CharField()
    completed_orders = serializers.IntegerField()
    pending_orders = serializers.IntegerField()
    cancelled_orders = serializers.IntegerField()


class FinancialKPISerializer(serializers.Serializer):
    today_platform_commission = serializers.CharField()
    monthly_platform_commission = serializers.CharField()
    total_platform_revenue = serializers.CharField()
    pending_settlements_payable = serializers.CharField()
    completed_settlements_paid = serializers.CharField()
    successful_payments_count = serializers.IntegerField()
    failed_payments_count = serializers.IntegerField()


class ProcurementKPISerializer(serializers.Serializer):
    total_purchase_orders = serializers.IntegerField()
    in_transit_pos = serializers.IntegerField()
    delivered_pos = serializers.IntegerField()
    unpaid_supplier_invoices_count = serializers.IntegerField()
    unpaid_supplier_invoices_amount = serializers.CharField()


class AdminDashboardResponseSerializer(serializers.Serializer):
    business = BusinessKPISerializer()
    sales = SalesKPISerializer()
    financial = FinancialKPISerializer()
    procurement = ProcurementKPISerializer()


class SalesTrendItemSerializer(serializers.Serializer):
    date = serializers.CharField()
    gmv = serializers.CharField()
    subtotal = serializers.CharField()
    tax = serializers.CharField()
    order_count = serializers.IntegerField()


class TopVendorItemSerializer(serializers.Serializer):
    vendor_id = serializers.CharField()
    business_name = serializers.CharField()
    total_sales = serializers.CharField()
    orders_fulfilled = serializers.IntegerField()
    platform_commission = serializers.CharField()


class TopProductItemSerializer(serializers.Serializer):
    product_id = serializers.CharField()
    product_name = serializers.CharField()
    vendor_name = serializers.CharField()
    total_units_sold = serializers.IntegerField()
    total_revenue = serializers.CharField()

