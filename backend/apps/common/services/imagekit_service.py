import hmac
import hashlib
import time
import uuid
from typing import Optional, Dict, Any
from urllib.parse import urlparse
from django.conf import settings


class ImageKitService:
    """
    Centralized service for ImageKit media operations:
    1. Direct client-side upload authentication token generation (HMAC-SHA1)
    2. CDN transformation URL generation (responsive sizing, webp/avif, watermarks, thumbnails)
    """

    @classmethod
    def get_public_key(cls) -> str:
        return getattr(settings, 'IMAGEKIT_PUBLIC_KEY', '')

    @classmethod
    def get_url_endpoint(cls) -> str:
        endpoint = getattr(settings, 'IMAGEKIT_URL_ENDPOINT', '')
        return endpoint.rstrip('/') if endpoint else 'https://ik.imagekit.io/oyopasal'

    @classmethod
    def get_client_upload_auth(cls, expire_seconds: int = 1800) -> Dict[str, Any]:
        """
        Generates authentication parameters required by frontend apps
        to securely upload media directly to ImageKit without proxying through Django.
        """
        private_key = getattr(settings, 'IMAGEKIT_PRIVATE_KEY', '')
        public_key = cls.get_public_key()
        token = str(uuid.uuid4())
        expire = int(time.time()) + expire_seconds

        if not private_key:
            # Safe mock signature for dev/testing when keys are not configured
            signature = hashlib.sha1(f"{token}{expire}mock_key".encode('utf-8')).hexdigest()
        else:
            signature = hmac.new(
                private_key.encode('utf-8'),
                f"{token}{expire}".encode('utf-8'),
                hashlib.sha1
            ).hexdigest()

        return {
            "token": token,
            "expire": expire,
            "signature": signature,
            "publicKey": public_key
        }

    @classmethod
    def build_transformation_string(cls, **kwargs) -> str:
        """
        Builds an ImageKit transformation string from keyword arguments.
        Example: width=300, height=300, quality=80 -> tr:w-300,h-300,q-80
        """
        param_map = {
            'width': 'w',
            'height': 'h',
            'quality': 'q',
            'format': 'f',
            'crop': 'c',
            'crop_mode': 'cm',
            'focus': 'fo',
            'blur': 'bl',
            'radius': 'r',
            'dpr': 'dpr',
            'rotate': 'rt',
        }

        parts = []
        for key, val in kwargs.items():
            if val is not None and key in param_map:
                parts.append(f"{param_map[key]}-{val}")

        return f"tr:{','.join(parts)}" if parts else ""

    @classmethod
    def get_transformed_url(cls, image_path_or_url: str, **transformations) -> str:
        """
        Appends transformation parameters to an ImageKit URL or path.
        """
        if not image_path_or_url:
            return ""

        tr_string = cls.build_transformation_string(**transformations)
        if not tr_string:
            return image_path_or_url

        endpoint = cls.get_url_endpoint()
        
        # If absolute URL already hosted on ImageKit
        if image_path_or_url.startswith('http://') or image_path_or_url.startswith('https://'):
            if endpoint in image_path_or_url:
                # Insert transformation right after endpoint
                base_after = image_path_or_url.replace(f"{endpoint}/", "")
                return f"{endpoint}/{tr_string}/{base_after}"
            return image_path_or_url

        clean_path = image_path_or_url.lstrip('/')
        return f"{endpoint}/{tr_string}/{clean_path}"

    @classmethod
    def get_thumbnail_url(cls, image_path_or_url: str, width: int = 300, height: int = 300) -> str:
        """Standard e-commerce catalog product card thumbnail."""
        return cls.get_transformed_url(
            image_path_or_url,
            width=width,
            height=height,
            crop_mode='pad_resize',
            quality=85,
            format='webp'
        )

    @classmethod
    def get_optimized_url(cls, image_path_or_url: str, quality: int = 80) -> str:
        """Optimized image with automatic WebP/AVIF format conversion."""
        return cls.get_transformed_url(
            image_path_or_url,
            quality=quality,
            format='auto'
        )

