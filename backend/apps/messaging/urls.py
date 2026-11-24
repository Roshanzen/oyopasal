from django.urls import path
from apps.messaging.views import (
    InitiateConversationView,
    ConversationListView,
    ConversationDetailView,
    ConversationMessagesView,
    ConversationMarkReadView,
    UnreadMessagesCountView,
)

app_name = 'messaging'

urlpatterns = [
    path('conversations/initiate/', InitiateConversationView.as_view(), name='initiate_conversation'),
    path('conversations/', ConversationListView.as_view(), name='conversation_list'),
    path('conversations/<uuid:pk>/', ConversationDetailView.as_view(), name='conversation_detail'),
    path('conversations/<uuid:pk>/messages/', ConversationMessagesView.as_view(), name='conversation_messages'),
    path('conversations/<uuid:pk>/read/', ConversationMarkReadView.as_view(), name='conversation_mark_read'),
    path('unread-count/', UnreadMessagesCountView.as_view(), name='unread_count'),
]
