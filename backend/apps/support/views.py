from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema
from apps.common.permissions import IsSupportAdmin, IsSuperAdmin
from .models import SupportTicket, TicketMessage
from .serializers import (
    SupportTicketSerializer,
    CreateTicketSerializer,
    TicketMessageSerializer,
    CreateMessageSerializer,
)

class CustomerTicketListCreateView(APIView):
    """Customer views their support tickets or creates a new ticket."""
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="List Customer Support Tickets")
    def get(self, request):
        tickets = SupportTicket.objects.filter(user=request.user).order_by('-created_at')
        return Response(SupportTicketSerializer(tickets, many=True).data)

    @extend_schema(
        summary="Create Support Ticket",
        request=CreateTicketSerializer,
        responses={201: SupportTicketSerializer}
    )
    def post(self, request):
        serializer = CreateTicketSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        initial_message = serializer.validated_data.pop('initial_message')

        ticket = SupportTicket.objects.create(
            user=request.user,
            **serializer.validated_data
        )

        TicketMessage.objects.create(
            ticket=ticket,
            sender=request.user,
            message=initial_message,
            is_staff_reply=False
        )

        return Response(SupportTicketSerializer(ticket).data, status=status.HTTP_201_CREATED)


class CustomerTicketDetailView(generics.RetrieveAPIView):
    """Retrieve details and complete conversation thread of a ticket."""
    serializer_class = SupportTicketSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or getattr(user, 'role', '') in ['SUPER_ADMIN', 'SUPPORT_ADMIN']:
            return SupportTicket.objects.all().prefetch_related('messages')
        return SupportTicket.objects.filter(user=user).prefetch_related('messages')

    @extend_schema(summary="Get Support Ticket Thread")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class TicketMessageCreateView(APIView):
    """Post a reply message to an open support ticket."""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Reply to Support Ticket",
        request=CreateMessageSerializer,
        responses={201: TicketMessageSerializer}
    )
    def post(self, request, id):
        try:
            user = request.user
            if user.is_staff or getattr(user, 'role', '') in ['SUPER_ADMIN', 'SUPPORT_ADMIN']:
                ticket = SupportTicket.objects.get(id=id)
                is_staff = True
            else:
                ticket = SupportTicket.objects.get(id=id, user=user)
                is_staff = False
        except SupportTicket.DoesNotExist:
            return Response({
                'success': False,
                'error': {'code': 'NOT_FOUND', 'message': 'Ticket not found.'}
            }, status=status.HTTP_404_NOT_FOUND)

        serializer = CreateMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        message = TicketMessage.objects.create(
            ticket=ticket,
            sender=request.user,
            message=serializer.validated_data['message'],
            attachment_url=serializer.validated_data.get('attachment_url', ''),
            is_staff_reply=is_staff
        )

        # Automatically update ticket updated_at
        ticket.save()

        return Response(TicketMessageSerializer(message).data, status=status.HTTP_201_CREATED)


class StaffTicketListView(generics.ListAPIView):
    """Staff Helpdesk view of all customer tickets across the ecosystem."""
    serializer_class = SupportTicketSerializer
    permission_classes = [IsSupportAdmin | IsSuperAdmin]

    def get_queryset(self):
        qs = SupportTicket.objects.all().prefetch_related('messages').order_by('-created_at')
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param.upper())
        return qs

    @extend_schema(summary="List All Tickets (Staff Helpdesk)")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

