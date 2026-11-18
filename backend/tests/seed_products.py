import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from decimal import Decimal
from django.utils.text import slugify
from apps.catalogue.models import Product, ProductVariant, ProductImage, Category, Brand
from apps.stores.models import Store
from apps.accounts.models import User

# Fetch references
first_prod = Product.objects.first()
vendor_id = first_prod.vendor_id if first_prod else None
store = Store.objects.first()
brand = Brand.objects.first()

pashmina_cat = Category.objects.filter(slug__icontains='pashmina').first() or Category.objects.first()
handicraft_cat = Category.objects.filter(slug__icontains='handicraft').first() or Category.objects.first()
charger_cat = Category.objects.filter(slug__icontains='charger').first() or Category.objects.first()
electronics_cat = Category.objects.filter(slug__icontains='electronics').first() or Category.objects.first()

products_data = [
    {
        'name': 'Himalayan Handwoven Cashmere Pashmina Shawl',
        'category': pashmina_cat,
        'regular_price': Decimal('5500.00'),
        'selling_price': Decimal('4500.00'),
        'image': 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=600&auto=format&fit=crop&q=80',
        'short_desc': '100% authentic Chyangra cashmere handspun by master weavers in Mustang.',
        'sku': 'PASH-MUS-01',
    },
    {
        'name': 'Organic Orthodox Ilam First-Flush Black Tea',
        'category': handicraft_cat,
        'regular_price': Decimal('1000.00'),
        'selling_price': Decimal('850.00'),
        'image': 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80',
        'short_desc': 'High-altitude organic orthodox spring tea packed directly at Ilam tea gardens.',
        'sku': 'TEA-ILAM-01',
    },
    {
        'name': 'Hand-Hammered 7-Metal Tibetan Singing Bowl',
        'category': handicraft_cat,
        'regular_price': Decimal('4200.00'),
        'selling_price': Decimal('3400.00'),
        'image': 'https://images.unsplash.com/photo-1514533450685-4493e01d1fdc?w=600&auto=format&fit=crop&q=80',
        'short_desc': 'Traditional Patan metalwork crafted for sound healing, meditation, and yoga.',
        'sku': 'BOWL-PAT-01',
    },
    {
        'name': 'Authentic Bhojpure Traditional Khukuri Knife',
        'category': handicraft_cat,
        'regular_price': Decimal('6000.00'),
        'selling_price': Decimal('5200.00'),
        'image': 'https://images.unsplash.com/photo-1595341888016-a392ef81b7de?w=600&auto=format&fit=crop&q=80',
        'short_desc': 'Hand-forged carbon steel blade with water buffalo horn handle and leather sheath.',
        'sku': 'KHUK-BHOJ-01',
    },
    {
        'name': 'GaN 100W Triple-Port USB-C Fast Charger',
        'category': charger_cat,
        'regular_price': Decimal('4800.00'),
        'selling_price': Decimal('3950.00'),
        'image': 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&auto=format&fit=crop&q=80',
        'short_desc': '100W PD 3.0 power delivery for laptops, tablets, and phones simultaneously.',
        'sku': 'CHG-GAN-100W',
    },
    {
        'name': 'Traditional Wooden Carved Peacock Window',
        'category': handicraft_cat,
        'regular_price': Decimal('9500.00'),
        'selling_price': Decimal('7800.00'),
        'image': 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80',
        'short_desc': 'Intricately hand-carved Newari architectural woodwork from Bhaktapur artisans.',
        'sku': 'WOOD-PEA-01',
    },
    {
        'name': 'Mustang Royal Sun-Dried Organic Apple Slices',
        'category': handicraft_cat,
        'regular_price': Decimal('1200.00'),
        'selling_price': Decimal('950.00'),
        'image': 'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=600&auto=format&fit=crop&q=80',
        'short_desc': 'Naturally sweetened sun-dried Marpha apples without additives or preservatives.',
        'sku': 'FOOD-APPL-01',
    },
    {
        'name': 'Pure Himalayan Yak Wool Blanket (Queen Size)',
        'category': pashmina_cat,
        'regular_price': Decimal('7800.00'),
        'selling_price': Decimal('6500.00'),
        'image': 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=600&auto=format&fit=crop&q=80',
        'short_desc': 'Ultra-warm and breathable hand-loomed blanket made of high-altitude Himalayan yak wool.',
        'sku': 'YAK-BLNK-01',
    },
    {
        'name': 'Authentic Handwoven Palpali Dhaka Topi',
        'category': handicraft_cat,
        'regular_price': Decimal('950.00'),
        'selling_price': Decimal('750.00'),
        'image': 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80',
        'short_desc': 'Classic Nepali national cultural cap woven with traditional hand-dyed cotton yarn.',
        'sku': 'DHAK-PAL-01',
    },
    {
        'name': 'Himalayan Wild Raw Cliff Honey (500g)',
        'category': handicraft_cat,
        'regular_price': Decimal('2300.00'),
        'selling_price': Decimal('1850.00'),
        'image': 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600&auto=format&fit=crop&q=80',
        'short_desc': 'Wild forest cliff honey sustainably harvested from foothills of Annapurna.',
        'sku': 'HON-CLF-01',
    },
    {
        'name': 'Fast Wireless Qi Charging Dock Station',
        'category': electronics_cat,
        'regular_price': Decimal('3500.00'),
        'selling_price': Decimal('2900.00'),
        'image': 'https://images.unsplash.com/photo-1622445262464-84b1456045b6?w=600&auto=format&fit=crop&q=80',
        'short_desc': '3-in-1 multi-device wireless charging stand for phones, earbuds, and smartwatches.',
        'sku': 'ELEC-QI-3IN1',
    },
    {
        'name': 'Silk Canvas Buddhist Mandala Thangka Scroll',
        'category': handicraft_cat,
        'regular_price': Decimal('11000.00'),
        'selling_price': Decimal('8900.00'),
        'image': 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=600&auto=format&fit=crop&q=80',
        'short_desc': 'Genuine gold leaf and natural stone mineral pigment painting on silk brocade.',
        'sku': 'ART-THNK-01',
    },
]

created_count = 0
for item in products_data:
    slug = slugify(item['name'])
    p, created = Product.objects.get_or_create(
        slug=slug,
        defaults={
            'name': item['name'],
            'category': item['category'],
            'vendor_id': vendor_id,
            'store': store,
            'brand': brand,
            'base_sku': item['sku'],
            'short_description': item['short_desc'],
            'description': item['short_desc'],
            'status': 'APPROVED',
            'is_featured': True,
            'is_returnable': True,
            'tax_rate': Decimal('13.00'),
        }
    )
    if created:
        created_count += 1
        var = ProductVariant.objects.create(
            product=p,
            sku=f"{item['sku']}-STD",
            regular_price=item['regular_price'],
            selling_price=item['selling_price'],
            is_default=True,
            is_active=True,
        )
        ProductImage.objects.create(
            product=p,
            variant=var,
            image_url=item['image'],
            alt_text=item['name'],
            is_primary=True,
            ordering=0,
        )

print(f"Successfully seeded {created_count} authentic products! Total catalog count: {Product.objects.count()}")

