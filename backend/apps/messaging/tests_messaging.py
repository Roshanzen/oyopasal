from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserRole
from apps.vendors.models import VendorProfile, VendorStatus
from apps.stores.models import Store
from apps.catalogue.models import Category, Product
from apps.messaging.models import Conversation, Message

User = get_user_model()


class CustomerVendorMessagingTests(APITestCase):
    """
    Automated test suite verifying the in-platform Customer-Vendor messaging system.
    Covers conversation lifecycle, deduplication, message persistence, data isolation,
    cross-vendor security, and unread counts.
    """
    def setUp(self):
        # 1. Customers
        self.customer1 = User.objects.create_user(
            email='msg_customer1@oyopasal.com',
            password='CustomerPassword123!',
            first_name='Anil',
            last_name='Gurung',
            role=UserRole.CUSTOMER,
            is_verified=True
        )
        self.customer2 = User.objects.create_user(
            email='msg_customer2@oyopasal.com',
            password='CustomerPassword123!',
            first_name='Bikash',
            last_name='Thapa',
            role=UserRole.CUSTOMER,
            is_verified=True
        )

        # 2. Vendor 1
        self.vendor1_user = User.objects.create_user(
            email='msg_vendor1@oyopasal.com',
            password='VendorPassword123!',
            first_name='Deepak',
            last_name='Shrestha',
            role=UserRole.VENDOR_OWNER,
            is_verified=True
        )
        self.vendor1_profile = VendorProfile.objects.create(
            user=self.vendor1_user,
            business_name='Himalayan Organic Mart',
            slug='him-organic-mart',
            status=VendorStatus.APPROVED
        )
        self.store1 = Store.objects.create(
            vendor=self.vendor1_profile,
            name='Patan Organic Outlet',
            slug='patan-organic-outlet',
            is_active=True,
            is_verified=True
        )

        # 3. Vendor 2 (Separate competitor)
        self.vendor2_user = User.objects.create_user(
            email='msg_vendor2@oyopasal.com',
            password='VendorPassword123!',
            first_name='Gopal',
            last_name='Karki',
            role=UserRole.VENDOR_OWNER,
            is_verified=True
        )
        self.vendor2_profile = VendorProfile.objects.create(
            user=self.vendor2_user,
            business_name='Everest Electronic Hub',
            slug='everest-electronic-hub',
            status=VendorStatus.APPROVED
        )
        self.store2 = Store.objects.create(
            vendor=self.vendor2_profile,
            name='Everest Tech Store',
            slug='everest-tech-store',
            is_active=True,
            is_verified=True
        )

        # 4. Product Context
        self.cat = Category.objects.create(name='Organic Tea & Honey', slug='organic-tea-honey', is_active=True)
        self.product1 = Product.objects.create(
            vendor=self.vendor1_profile,
            store=self.store1,
            category=self.cat,
            name='Ilam Wildflower Raw Honey',
            base_sku='HONEY-ILAM-01'
        )

        self.initiate_url = reverse('messaging:initiate_conversation')
        self.conversation_list_url = reverse('messaging:conversation_list')
        self.unread_count_url = reverse('messaging:unread_count')

    def test_customer_initiates_conversation_and_reuses_existing(self):
        """Customer starts conversation with a store; subsequent requests reuse the same conversation without duplication."""
        self.client.force_authenticate(user=self.customer1)

        payload = {
            'store_id': str(self.store1.id),
            'product_id': str(self.product1.id),
            'initial_message': 'Is this wildflower honey 100% raw and organic?'
        }

        # 1. First initiation creates conversation
        res1 = self.client.post(self.initiate_url, payload, format='json')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res1.data['is_new'])
        conv_id = res1.data['conversation']['id']
        self.assertEqual(res1.data['conversation']['store_slug'], self.store1.slug)
        self.assertEqual(res1.data['conversation']['product_context']['name'], self.product1.name)

        # 2. Second initiation with same store returns existing conversation
        res2 = self.client.post(self.initiate_url, {'store_id': self.store1.slug}, format='json')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertFalse(res2.data['is_new'])
        self.assertEqual(res2.data['conversation']['id'], conv_id)

        # Verify only 1 record exists in database
        self.assertEqual(Conversation.objects.filter(customer=self.customer1, store=self.store1).count(), 1)

    def test_vendor_cannot_message_own_store(self):
        """Vendors cannot initiate customer chat conversations with their own store."""
        self.client.force_authenticate(user=self.vendor1_user)

        res = self.client.post(self.initiate_url, {'store_id': str(self.store1.id)}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data['code'], 'CANNOT_MESSAGE_OWN_STORE')

    def test_send_and_receive_messages_with_unread_counts(self):
        """Messages sent by customer increment vendor unread count; vendor replies increment customer unread count."""
        # Initiate conversation
        conv = Conversation.objects.create(
            customer=self.customer1,
            vendor=self.vendor1_profile,
            store=self.store1
        )
        msg_url = reverse('messaging:conversation_messages', kwargs={'pk': conv.id})
        detail_url = reverse('messaging:conversation_detail', kwargs={'pk': conv.id})

        # 1. Customer sends message
        self.client.force_authenticate(user=self.customer1)
        res_c1 = self.client.post(msg_url, {'content': 'Namaste! Do you deliver inside Ring Road?'}, format='json')
        self.assertEqual(res_c1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_c1.data['data']['sender_role'], 'CUSTOMER')
        self.assertTrue(res_c1.data['data']['is_mine'])

        conv.refresh_from_db()
        self.assertEqual(conv.vendor_unread_count, 1)
        self.assertEqual(conv.customer_unread_count, 0)

        # 2. Vendor checks unread count and opens conversation
        self.client.force_authenticate(user=self.vendor1_user)
        res_unread = self.client.get(self.unread_count_url)
        self.assertEqual(res_unread.data['data']['vendor_unread'], 1)

        # Opening detail view marks conversation as read for vendor
        res_detail = self.client.get(detail_url)
        self.assertEqual(res_detail.status_code, status.HTTP_200_OK)

        conv.refresh_from_db()
        self.assertEqual(conv.vendor_unread_count, 0)

        # 3. Vendor replies
        res_v1 = self.client.post(msg_url, {'content': 'Namaste! Yes, we deliver anywhere inside Kathmandu valley within 2 hours.'}, format='json')
        self.assertEqual(res_v1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_v1.data['data']['sender_role'], 'VENDOR')

        conv.refresh_from_db()
        self.assertEqual(conv.customer_unread_count, 1)
        self.assertEqual(conv.vendor_unread_count, 0)

    def test_customer_conversation_isolation(self):
        """Customer 2 cannot view or send messages into Customer 1's conversation."""
        conv = Conversation.objects.create(
            customer=self.customer1,
            vendor=self.vendor1_profile,
            store=self.store1
        )
        detail_url = reverse('messaging:conversation_detail', kwargs={'pk': conv.id})
        msg_url = reverse('messaging:conversation_messages', kwargs={'pk': conv.id})

        self.client.force_authenticate(user=self.customer2)

        # Customer 2 cannot read detail
        res_get = self.client.get(detail_url)
        self.assertEqual(res_get.status_code, status.HTTP_403_FORBIDDEN)

        # Customer 2 cannot post message
        res_post = self.client.post(msg_url, {'content': 'Intruder message'}, format='json')
        self.assertEqual(res_post.status_code, status.HTTP_403_FORBIDDEN)

    def test_cross_vendor_conversation_isolation(self):
        """Vendor 2 cannot view or reply to conversations belonging to Vendor 1's store."""
        conv = Conversation.objects.create(
            customer=self.customer1,
            vendor=self.vendor1_profile,
            store=self.store1
        )
        detail_url = reverse('messaging:conversation_detail', kwargs={'pk': conv.id})
        msg_url = reverse('messaging:conversation_messages', kwargs={'pk': conv.id})

        # Vendor 2 tries to access Vendor 1's chat
        self.client.force_authenticate(user=self.vendor2_user)

        res_get = self.client.get(detail_url)
        self.assertEqual(res_get.status_code, status.HTTP_403_FORBIDDEN)

        res_post = self.client.post(msg_url, {'content': 'Spying vendor attempt'}, format='json')
        self.assertEqual(res_post.status_code, status.HTTP_403_FORBIDDEN)

    def test_conversation_list_roles_and_search(self):
        """Conversation list partitions records by role and allows keyword search."""
        Conversation.objects.create(
            customer=self.customer1,
            vendor=self.vendor1_profile,
            store=self.store1,
            last_message_preview='Honey inquiry'
        )
        Conversation.objects.create(
            customer=self.customer1,
            vendor=self.vendor2_profile,
            store=self.store2,
            last_message_preview='Headphones inquiry'
        )

        # Customer 1 sees 2 conversations
        self.client.force_authenticate(user=self.customer1)
        res_c = self.client.get(self.conversation_list_url)
        self.assertEqual(res_c.status_code, status.HTTP_200_OK)
        items_c = res_c.data.get('results', res_c.data)
        self.assertEqual(len(items_c), 2)

        # Search by keyword
        res_search = self.client.get(f"{self.conversation_list_url}?q=Honey")
        items_search = res_search.data.get('results', res_search.data)
        self.assertEqual(len(items_search), 1)
        self.assertEqual(items_search[0]['store_slug'], self.store1.slug)

        # Vendor 1 sees only their store conversation
        self.client.force_authenticate(user=self.vendor1_user)
        res_v = self.client.get(f"{self.conversation_list_url}?as_role=vendor")
        self.assertEqual(res_v.status_code, status.HTTP_200_OK)
        items_v = res_v.data.get('results', res_v.data)
        self.assertEqual(len(items_v), 1)
        self.assertEqual(items_v[0]['store_slug'], self.store1.slug)
