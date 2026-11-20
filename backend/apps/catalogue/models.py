from django.db import models
from django.conf import settings
from django.utils.text import slugify
from apps.common.models import BaseModel, SoftDeletableModel
from apps.vendors.models import VendorProfile
from apps.stores.models import Store

class Category(BaseModel, SoftDeletableModel):
    """
    Hierarchical product category structure supporting arbitrary subcategory depths.
    """
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='subcategories'
    )
    name = models.CharField(max_length=150, db_index=True)
    slug = models.SlugField(max_length=180, unique=True, db_index=True)
    description = models.TextField(blank=True)
    icon_url = models.URLField(max_length=500, blank=True)
    image_url = models.URLField(max_length=500, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    ordering = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = 'Category'
        verbose_name_plural = 'Categories'
        ordering = ['ordering', 'name']

    def __str__(self):
        if self.parent:
            return f"{self.parent.name} > {self.name}"
        return self.name

    def get_ancestors(self):
        """Returns ancestor categories from root down to parent for breadcrumbs."""
        ancestors = []
        curr = self.parent
        while curr:
            ancestors.append(curr)
            curr = curr.parent
        return ancestors[::-1]

    def get_descendant_ids(self):
        """Returns self.id and all active descendant subcategory IDs recursively."""
        descendant_ids = [self.id]
        queue = list(self.subcategories.filter(is_active=True).values_list('id', flat=True))
        while queue:
            child_id = queue.pop(0)
            descendant_ids.append(child_id)
            queue.extend(list(Category.objects.filter(parent_id=child_id, is_active=True).values_list('id', flat=True)))
        return descendant_ids

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name) or 'cat'
            slug = base_slug
            counter = 1
            while Category.objects.filter(slug=slug).exclude(id=self.id).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)


class Brand(BaseModel, SoftDeletableModel):
    """
    Product brand registry.
    """
    name = models.CharField(max_length=150, unique=True, db_index=True)
    slug = models.SlugField(max_length=180, unique=True, db_index=True)
    logo_url = models.URLField(max_length=500, blank=True)
    website = models.URLField(blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        verbose_name = 'Brand'
        verbose_name_plural = 'Brands'
        ordering = ['name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name) or 'brand'
        super().save(*args, **kwargs)


class ProductStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    SUBMITTED = 'SUBMITTED', 'Submitted for Review'
    APPROVED = 'APPROVED', 'Approved & Active'
    REJECTED = 'REJECTED', 'Rejected'
    SUSPENDED = 'SUSPENDED', 'Suspended'
    ARCHIVED = 'ARCHIVED', 'Archived'


class Product(BaseModel, SoftDeletableModel):
    """
    Core marketplace product entity owned by a vendor and attached to a store.
    """
    vendor = models.ForeignKey(
        VendorProfile,
        on_delete=models.CASCADE,
        related_name='products'
    )
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='products'
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name='products'
    )
    brand = models.ForeignKey(
        Brand,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products'
    )

    name = models.CharField(max_length=255, db_index=True)
    slug = models.SlugField(max_length=280, unique=True, db_index=True)
    base_sku = models.CharField(max_length=100, unique=True, db_index=True)
    short_description = models.CharField(max_length=500, blank=True)
    description = models.TextField(blank=True)

    status = models.CharField(
        max_length=20,
        choices=ProductStatus.choices,
        default=ProductStatus.DRAFT,
        db_index=True
    )
    rejection_reason = models.TextField(blank=True)
    moderated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='moderated_products'
    )
    moderated_at = models.DateTimeField(null=True, blank=True)

    # Tax & Logistics settings
    tax_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=13.00,
        help_text='VAT/Tax percentage in Nepal (e.g. 13.00 for 13%)'
    )
    unit = models.CharField(
        max_length=50,
        default='piece',
        help_text='Product selling unit e.g. kg, gram, litre, piece, pack'
    )
    is_organic = models.BooleanField(
        default=False,
        db_index=True,
        help_text='Whether the product is certified organic produce'
    )
    sections = models.JSONField(
        default=list,
        blank=True,
        help_text='Featured placement sections e.g. ["fresh_arrivals", "best_sellers"]'
    )
    is_featured = models.BooleanField(default=False, db_index=True)
    is_returnable = models.BooleanField(default=True)
    warranty_info = models.CharField(max_length=255, blank=True)

    class Meta:
        verbose_name = 'Product'
        verbose_name_plural = 'Products'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['category', 'status']),
            models.Index(fields=['vendor', 'status']),
            models.Index(fields=['is_featured', 'status']),
        ]

    def __str__(self):
        return f"{self.name} ({self.base_sku})"

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name) or str(self.id)[:8]
            slug = base_slug
            counter = 1
            while Product.objects.filter(slug=slug).exclude(id=self.id).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)


class ProductVariant(BaseModel, SoftDeletableModel):
    """
    Product variant combinations (e.g. Size, Color, Storage capacity).
    Each variant has an independent SKU, barcode, and pricing.
    """
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='variants'
    )
    sku = models.CharField(max_length=100, unique=True, db_index=True)
    barcode = models.CharField(max_length=100, blank=True)
    regular_price = models.DecimalField(max_digits=12, decimal_places=2)
    selling_price = models.DecimalField(max_digits=12, decimal_places=2)
    attributes = models.JSONField(
        default=dict,
        blank=True,
        help_text='Attributes key-value dictionary e.g. {"color": "Midnight Blue", "size": "L"}'
    )
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        verbose_name = 'Product Variant'
        verbose_name_plural = 'Product Variants'
        ordering = ['product', '-is_default', 'regular_price']
        indexes = [
            models.Index(fields=['product', 'is_active']),
            models.Index(fields=['selling_price', 'is_active']),
        ]

    def __str__(self):
        return f"{self.product.name} - {self.sku}"

    @property
    def discount_percentage(self):
        if self.regular_price and self.regular_price > self.selling_price:
            calc = ((self.regular_price - self.selling_price) / self.regular_price) * 100
            return float(round(calc, 1))
        return 0.0


class ProductImage(BaseModel):
    """
    Product media gallery images, optionally associated with a specific variant.
    """
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='images'
    )
    variant = models.ForeignKey(
        ProductVariant,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='images'
    )
    image_url = models.CharField(max_length=500)
    alt_text = models.CharField(max_length=255, blank=True)
    is_primary = models.BooleanField(default=False)
    ordering = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = 'Product Image'
        verbose_name_plural = 'Product Images'
        ordering = ['ordering', '-is_primary', '-created_at']

    def __str__(self):
        return f"Image for {self.product.name}"


class ProductModerationLog(BaseModel):
    """
    Audit log tracking product approval, rejection, suspension, and reasons.
    """
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='moderation_logs'
    )
    action = models.CharField(max_length=50)
    previous_status = models.CharField(max_length=30)
    new_status = models.CharField(max_length=30)
    reason = models.TextField(blank=True)
    action_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.product.name}: {self.previous_status} -> {self.new_status}"
