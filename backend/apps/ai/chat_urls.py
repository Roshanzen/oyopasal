from django.urls import path
from .chat_views import ChatConciergeView, DirectChatOrderView

app_name = 'chat'

urlpatterns = [
    path('', ChatConciergeView.as_view(), name='concierge_chat'),
    path('direct-order/', DirectChatOrderView.as_view(), name='direct_chat_order'),
]
