import base64
import os
import re
import time
import uuid
from pathlib import Path
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from drf_spectacular.utils import extend_schema

from apps.common.models import MediaAsset

ALLOWED_MEDIA_ROLES = {
    'SUPER_ADMIN', 'ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_ADMIN', 'FINANCE_ADMIN',
    'VENDOR_OWNER', 'VENDOR_STAFF', 'SUPPLIER_OWNER', 'SUPPLIER_STAFF'
}

def detect_image_type(buffer: bytes) -> str | None:
    """Validate image magic bytes. Returns detected extension or None."""
    if len(buffer) < 8:
        return None
    if buffer.startswith(b'\xff\xd8\xff'):
        return 'jpg'
    if buffer.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'png'
    if buffer.startswith(b'GIF87a') or buffer.startswith(b'GIF89a'):
        return 'gif'
    if len(buffer) >= 12 and buffer[:4] == b'RIFF' and buffer[8:12] == b'WEBP':
        return 'webp'
    return None

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


class MediaUploadView(APIView):
    """
    Handles file/data_url image uploads from the admin/seller portals.
    Supports data_url, base64 strings, or direct multipart form uploads.
    Restricted to authenticated sellers and administrators.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    @extend_schema(
        summary="Upload Media Asset",
        description="Uploads an image via base64, data_url, or multipart/form-data.",
        responses={201: dict, 400: dict}
    )
    def post(self, request):
        user = request.user
        user_role = getattr(user, 'role', '')
        if not (user.is_staff or user.is_superuser or user_role in ALLOWED_MEDIA_ROLES):
            return Response({
                'success': False,
                'error': {
                    'code': 'FORBIDDEN',
                    'message': 'Only sellers and platform administrators are authorized to upload media.'
                }
            }, status=status.HTTP_403_FORBIDDEN)

        data = request.data or {}
        data_url = data.get('data_url', '')
        raw_b64 = data.get('base64', '')
        filename = data.get('filename') or 'upload.png'
        mime_type = (data.get('mime_type') or '').lower().strip()
        entity_type = (data.get('entity_type') or 'general').strip()
        entity_id = data.get('entity_id')

        buffer = None

        # 1. Handle multipart file upload if sent
        if 'file' in request.FILES:
            uploaded_file = request.FILES['file']
            filename = uploaded_file.name
            mime_type = uploaded_file.content_type.lower()
            buffer = uploaded_file.read()
        elif 'image' in request.FILES:
            uploaded_file = request.FILES['image']
            filename = uploaded_file.name
            mime_type = uploaded_file.content_type.lower()
            buffer = uploaded_file.read()

        # 2. Handle data_url
        elif data_url and data_url.startswith('data:'):
            match = re.match(r'^data:([^;]+);base64,(.+)$', data_url.strip(), re.DOTALL)
            if not match:
                return Response({
                    'success': False,
                    'error': {'code': 'INVALID_IMAGE_DATA', 'message': 'Invalid data_url encoding.'}
                }, status=status.HTTP_400_BAD_REQUEST)
            mime_type = match.group(1).lower().strip()
            raw_b64 = match.group(2)
            try:
                buffer = base64.b64decode(raw_b64)
            except Exception:
                return Response({
                    'success': False,
                    'error': {'code': 'INVALID_BASE64', 'message': 'Failed to decode base64 image data.'}
                }, status=status.HTTP_400_BAD_REQUEST)

        # 3. Handle raw base64
        elif raw_b64:
            try:
                buffer = base64.b64decode(raw_b64)
            except Exception:
                return Response({
                    'success': False,
                    'error': {'code': 'INVALID_BASE64', 'message': 'Failed to decode base64 image data.'}
                }, status=status.HTTP_400_BAD_REQUEST)

        if not buffer:
            return Response({
                'success': False,
                'error': {'code': 'MISSING_IMAGE_DATA', 'message': 'Image payload (data_url, base64, or file) is required.'}
            }, status=status.HTTP_400_BAD_REQUEST)

        if len(buffer) > MAX_UPLOAD_BYTES:
            return Response({
                'success': False,
                'error': {'code': 'FILE_TOO_LARGE', 'message': 'Image exceeds maximum 10 MB size limit.'}
            }, status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)

        # Strictly validate image content using magic bytes
        detected_ext = detect_image_type(buffer)
        if not detected_ext:
            return Response({
                'success': False,
                'error': {
                    'code': 'UNSUPPORTED_FILE_TYPE',
                    'message': 'Only valid JPEG, PNG, WebP, and GIF images are permitted.'
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        ext = detected_ext
        mime_type = f"image/{'jpeg' if ext == 'jpg' else ext}"

        # Safe filename stem to prevent path traversal or overwrite
        safe_stem = re.sub(r'[^a-zA-Z0-9_-]+', '-', Path(filename).stem).strip('-')[:32] or 'asset'
        stored_name = f"{int(time.time())}_{uuid.uuid4().hex[:12]}_{safe_stem}.{ext}"

        # Write to public/uploads in root workspace
        public_uploads_dir = Path(settings.BASE_DIR).parent / 'public' / 'uploads'
        public_uploads_dir.mkdir(parents=True, exist_ok=True)
        disk_path = public_uploads_dir / stored_name
        with open(disk_path, 'wb') as f:
            f.write(buffer)

        # Also write to MEDIA_ROOT / 'uploads'
        media_uploads_dir = Path(settings.MEDIA_ROOT) / 'uploads'
        media_uploads_dir.mkdir(parents=True, exist_ok=True)
        media_disk_path = media_uploads_dir / stored_name
        try:
            with open(media_disk_path, 'wb') as f:
                f.write(buffer)
        except Exception:
            pass

        public_url = f"/uploads/{stored_name}"

        owner = request.user if getattr(request, 'user', None) and request.user.is_authenticated else None

        asset = MediaAsset.objects.create(
            owner=owner,
            entity_type=entity_type or 'general',
            entity_id=str(entity_id) if entity_id else None,
            filename=filename,
            mime_type=mime_type,
            size_bytes=len(buffer),
            url=public_url,
            storage_path=str(disk_path)
        )

        return Response({
            'success': True,
            'asset': {
                'id': asset.id,
                'url': asset.url,
                'filename': asset.filename,
                'mime_type': asset.mime_type,
                'size_bytes': asset.size_bytes,
                'entity_type': asset.entity_type,
                'created_at': asset.created_at.isoformat()
            }
        }, status=status.HTTP_201_CREATED)


class MediaAssetListView(APIView):
    """
    List uploaded media assets.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user if getattr(request, 'user', None) and request.user.is_authenticated else None
        if user and (getattr(user, 'role', '') in ('ADMIN', 'SUPER_ADMIN') or user.is_staff):
            qs = MediaAsset.objects.all()[:100]
        elif user:
            qs = MediaAsset.objects.filter(owner=user)[:50]
        else:
            qs = MediaAsset.objects.none()

        return Response({
            'count': qs.count(),
            'results': [
                {
                    'id': a.id,
                    'url': a.url,
                    'filename': a.filename,
                    'mime_type': a.mime_type,
                    'size_bytes': a.size_bytes,
                    'entity_type': a.entity_type,
                    'entity_id': a.entity_id,
                    'created_at': a.created_at.isoformat() if a.created_at else None,
                }
                for a in qs
            ]
        })


class MediaAssetDetailView(APIView):
    """
    Delete a media asset and clean up its file on disk.
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            asset = MediaAsset.objects.get(pk=pk)
        except MediaAsset.DoesNotExist:
            return Response({
                'success': False,
                'error': {'code': 'NOT_FOUND', 'message': 'Media asset not found.'}
            }, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        is_admin = getattr(user, 'role', '') in ('ADMIN', 'SUPER_ADMIN') or user.is_staff
        if not is_admin and asset.owner and asset.owner != user:
            return Response({
                'success': False,
                'error': {'code': 'FORBIDDEN', 'message': 'You can only delete your own media assets.'}
            }, status=status.HTTP_403_FORBIDDEN)

        if asset.storage_path and os.path.exists(asset.storage_path):
            try:
                os.remove(asset.storage_path)
            except OSError:
                pass

        asset.delete()
        return Response({'success': True})
