from datetime import datetime
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework import permissions
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes
from apps.common.permissions import IsSuperAdmin, IsFinanceAdmin, IsOperationsAdmin, IsVendor
from .services import ReportService

class SalesReportCSVView(APIView):
    """
    Exports sales data to CSV. Super Admins see all platform sales.
    Vendors only receive records for their own store/orders.
    """
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary="Reports: Export Sales CSV",
        description="Generates and streams a CSV report of suborders. Vendors only see their own sales.",
        parameters=[
            OpenApiParameter('start_date', OpenApiTypes.DATE, description="Filter orders on/after YYYY-MM-DD", required=False),
            OpenApiParameter('end_date', OpenApiTypes.DATE, description="Filter orders on/before YYYY-MM-DD", required=False),
        ],
        responses={200: OpenApiTypes.BINARY}
    )
    def get(self, request, *args, **kwargs):
        vendor = None
        user = request.user
        if user.role not in ['SUPER_ADMIN', 'FINANCE_ADMIN', 'OPERATIONS_ADMIN'] and not user.is_superuser:
            if hasattr(user, 'vendor_profile'):
                vendor = user.vendor_profile
            else:
                return HttpResponse("Unauthorized", status=403)

        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        parsed_start = None
        parsed_end = None
        if start_date:
            try:
                parsed_start = datetime.strptime(start_date, '%Y-%m-%d').date()
            except ValueError:
                pass
        if end_date:
            try:
                parsed_end = datetime.strptime(end_date, '%Y-%m-%d').date()
            except ValueError:
                pass

        csv_content = ReportService.export_sales_csv(
            start_date=parsed_start,
            end_date=parsed_end,
            vendor=vendor
        )

        filename = f"sales_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        response = HttpResponse(csv_content, content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class TaxReportCSVView(APIView):
    """
    Exports Nepal VAT (13%) & Inland Revenue compliance tax records in CSV format.
    """
    permission_classes = [permissions.IsAuthenticated, IsFinanceAdmin]

    @extend_schema(
        summary="Reports: Export VAT & Tax Compliance CSV",
        description="Generates an Inland Revenue Department (IRD) compliant VAT breakdown report.",
        parameters=[
            OpenApiParameter('start_date', OpenApiTypes.DATE, description="Filter orders on/after YYYY-MM-DD", required=False),
            OpenApiParameter('end_date', OpenApiTypes.DATE, description="Filter orders on/before YYYY-MM-DD", required=False),
        ],
        responses={200: OpenApiTypes.BINARY}
    )
    def get(self, request, *args, **kwargs):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        parsed_start = None
        parsed_end = None
        if start_date:
            try:
                parsed_start = datetime.strptime(start_date, '%Y-%m-%d').date()
            except ValueError:
                pass
        if end_date:
            try:
                parsed_end = datetime.strptime(end_date, '%Y-%m-%d').date()
            except ValueError:
                pass

        csv_content = ReportService.export_tax_vat_csv(
            start_date=parsed_start,
            end_date=parsed_end
        )

        filename = f"tax_vat_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        response = HttpResponse(csv_content, content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class SettlementsReportCSVView(APIView):
    """
    Exports vendor settlement records in CSV format.
    """
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary="Reports: Export Settlements CSV",
        description="Generates payout statements. Vendors only see their own settlement runs.",
        responses={200: OpenApiTypes.BINARY}
    )
    def get(self, request, *args, **kwargs):
        vendor = None
        user = request.user
        if user.role not in ['SUPER_ADMIN', 'FINANCE_ADMIN'] and not user.is_superuser:
            if hasattr(user, 'vendor_profile'):
                vendor = user.vendor_profile
            else:
                return HttpResponse("Unauthorized", status=403)

        csv_content = ReportService.export_settlements_csv(vendor=vendor)
        filename = f"settlements_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        response = HttpResponse(csv_content, content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class InventoryReportCSVView(APIView):
    """
    Exports comprehensive warehouse stock audit logs in CSV format.
    """
    permission_classes = [permissions.IsAuthenticated, IsOperationsAdmin]

    @extend_schema(
        summary="Reports: Export Inventory Stock Audit CSV",
        description="Generates snapshot of warehouse stock, allocated reservations, and reorder health indicators.",
        responses={200: OpenApiTypes.BINARY}
    )
    def get(self, request, *args, **kwargs):
        csv_content = ReportService.export_inventory_csv()
        filename = f"inventory_audit_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        response = HttpResponse(csv_content, content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

