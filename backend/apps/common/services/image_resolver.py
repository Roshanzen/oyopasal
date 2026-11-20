import urllib.request
import urllib.parse
import re
import logging

logger = logging.getLogger(__name__)

def resolve_image_url(url: str) -> str:
    """
    Normalizes and resolves indirect image links (e.g. Google Share links, Google Image search
    results, Google Drive links, Instagram posts) to direct publicly-accessible image binaries.
    """
    if not url or not isinstance(url, str):
        return ''

    url = url.strip()
    if not url:
        return ''

    # 1. Google Drive
    gdrive = re.search(r'drive\.google\.com/(?:file/d/|open\?id=|uc\?.*id=)([a-zA-Z0-9_-]+)', url)
    if gdrive:
        return f'https://drive.google.com/uc?export=view&id={gdrive.group(1)}'

    # 2. Direct query param on google.com (imgres or url redirect)
    if 'imgres' in url or 'google.com/url' in url:
        try:
            parsed = urllib.parse.urlparse(url)
            qs = urllib.parse.parse_qs(parsed.query)
            if 'imgurl' in qs and qs['imgurl']:
                target = qs['imgurl'][0]
                if not 'lookaside.instagram.com' in target:
                    return target
            elif 'q' in qs and qs['q']:
                return qs['q'][0]
        except Exception as e:
            logger.warning(f"Failed to parse google params from {url}: {e}")

    # 3. Google share shortlink or redirect link (e.g. share.google/*, images.app.goo.gl/*)
    if any(domain in url for domain in ['share.google', 'images.app.goo.gl', 'goo.gl', 'google.com']):
        try:
            req = urllib.request.Request(
                url,
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            )
            with urllib.request.urlopen(req, timeout=6) as resp:
                final_url = resp.geturl()
                content_type = resp.headers.get('Content-Type', '')

                # If final_url contains imgres query params
                if 'imgres' in final_url:
                    parsed = urllib.parse.urlparse(final_url)
                    qs = urllib.parse.parse_qs(parsed.query)
                    if 'imgurl' in qs and qs['imgurl']:
                        imgurl = qs['imgurl'][0]
                        if 'lookaside.instagram.com' in imgurl and 'imgrefurl' in qs:
                            imgrefurl = qs['imgrefurl'][0]
                            try:
                                req2 = urllib.request.Request(
                                    imgrefurl,
                                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
                                )
                                with urllib.request.urlopen(req2, timeout=6) as resp2:
                                    html2 = resp2.read().decode('utf-8', 'ignore')
                                    m = re.findall(r'https://scontent[^\s"\'<>]+\.jpg[^\s"\'<>]*', html2)
                                    if m:
                                        return m[0].replace('&amp;', '&')
                            except Exception:
                                pass
                        return imgurl

                # If HTML was returned, check OpenGraph og:image
                if 'text/html' in content_type:
                    html = resp.read().decode('utf-8', 'ignore')
                    og = re.search(r'<meta property=[\"\']og:image[\"\'] content=[\"\']([^\"\']+)[\"\']', html)
                    if og:
                        return og.group(1).replace('&amp;', '&')
                    # Look for high res images in page
                    cdn_matches = re.findall(r'https://[^\s"\'<>]+\.(?:jpg|jpeg|png|webp)[^\s"\'<>]*', html)
                    if cdn_matches:
                        return cdn_matches[0].replace('&amp;', '&')
        except Exception as e:
            logger.warning(f"Could not resolve share link {url}: {e}")

    if url.startswith('http://') and not any(h in url for h in ['localhost', '127.0.0.1', '0.0.0.0']):
        if 'twobrothersindiashop.com' in url or 'unsplash.com' in url or 'shopify.com' in url:
            url = url.replace('http://', 'https://')

    return url

