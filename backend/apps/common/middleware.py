import uuid

class RequestContextMiddleware:
    """
    Attaches a unique request_id to each incoming request and sets it in the response header.
    Useful for distributed tracing, audit logging, and error correlation.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = request.headers.get('X-Request-ID', str(uuid.uuid4()))
        request.request_id = request_id

        response = self.get_response(request)
        response['X-Request-ID'] = request_id
        return response

