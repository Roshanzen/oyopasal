from django.apps import AppConfig

class StoresConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.stores'
    verbose_name = 'Store Management'

    def ready(self):
        try:
            import apps.stores.signals  # noqa: F401
        except ImportError:
            pass

