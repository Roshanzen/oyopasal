from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

    def get_paginated_response(self, data):
        total_count = self.page.paginator.count
        next_url = self.get_next_link()
        prev_url = self.get_previous_link()
        return Response({
            'count': total_count,
            'next': next_url,
            'previous': prev_url,
            'results': data,
            'success': True,
            'message': 'Data retrieved successfully',
            'data': data,
            'meta': {
                'page': self.page.number,
                'page_size': self.get_page_size(self.request),
                'total_count': total_count,
                'total_pages': self.page.paginator.num_pages,
                'has_next': self.page.has_next(),
                'has_previous': self.page.has_previous(),
            }
        })


