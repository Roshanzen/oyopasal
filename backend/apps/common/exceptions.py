from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

def custom_exception_handler(exc, context):
    """
    Standardize all API error responses to:
    {
      "success": false,
      "error": {
        "code": "...",
        "message": "...",
        "details": { ... }
      }
    }
    """
    response = exception_handler(exc, context)

    if response is not None:
        code = getattr(exc, 'default_code', 'ERROR').upper()
        message = 'An error occurred while processing your request.'

        # Extract message if available
        if isinstance(response.data, dict):
            if 'detail' in response.data:
                message = str(response.data['detail'])
                details = {k: v for k, v in response.data.items() if k != 'detail'}
            else:
                details = response.data
                # Extract first field validation error as primary message
                for field_name, err in details.items():
                    if isinstance(err, list) and err:
                        message = str(err[0])
                        break
                    elif isinstance(err, str):
                        message = err
                        break
        elif isinstance(response.data, list):
            details = {'non_field_errors': response.data}
        else:
            details = {'error': str(response.data)}

        response.data = {
            'success': False,
            'error': {
                'code': code,
                'message': message,
                'details': details or None,
            }
        }
    return response

