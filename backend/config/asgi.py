import os
import sys
from pathlib import Path
from django.core.asgi import get_asgi_application

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BASE_DIR / 'apps'))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

# Initialize Django ASGI application early to ensure AppRegistry is populated
django_asgi_app = get_asgi_application()

try:
    from channels.routing import ProtocolTypeRouter, URLRouter
    from channels.auth import AuthMiddlewareStack

    application = ProtocolTypeRouter({
        "http": django_asgi_app,
        # Real-time WebSocket routing will be wired in Phase 3/4
        # "websocket": AuthMiddlewareStack(URLRouter([...])),
    })
except ImportError:
    application = django_asgi_app

