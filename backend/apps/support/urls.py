from django.urls import path
from .views import (
    CustomerTicketListCreateView,
    CustomerTicketDetailView,
    TicketMessageCreateView,
    StaffTicketListView,
)

app_name = 'support'

urlpatterns = [
    path('tickets/', CustomerTicketListCreateView.as_view(), name='ticket_list_create'),
    path('tickets/<uuid:pk>/', CustomerTicketDetailView.as_view(), name='ticket_detail'),
    path('tickets/<uuid:id>/messages/', TicketMessageCreateView.as_view(), name='ticket_message_create'),
    path('staff/tickets/', StaffTicketListView.as_view(), name='staff_ticket_list'),
]

