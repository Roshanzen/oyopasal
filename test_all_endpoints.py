import urllib.request
import urllib.error
import json
import sys

BASE_URL = "http://127.0.0.1:8000"

def get(path, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            return resp.status, data
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        try:
            return e.code, json.loads(err_body)
        except:
            return e.code, err_body

def post(path, payload, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            return resp.status, data
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        try:
            return e.code, json.loads(err_body)
        except:
            return e.code, err_body

print("=== TESTING ALL 10 CRITICAL ENDPOINTS ===")

endpoints = [
    ("Categories", "/api/v1/categories/"),
    ("Products", "/api/v1/products/"),
    ("Vendors", "/api/v1/vendors/"),
    ("Notifications", "/api/v1/notifications/"),
    ("Promotions", "/api/v1/promotions/"),
    ("Advertisements", "/api/v1/advertisements/"),
    ("Public Settings", "/api/v1/settings/public/"),
    ("Cart", "/api/v1/cart/"),
    ("Wishlist", "/api/v1/wishlist/"),
]

all_passed = True

for name, path in endpoints:
    status, res = get(path)
    count = None
    if isinstance(res, dict):
        count = res.get('count', len(res.get('results', [])) if 'results' in res else None)
    elif isinstance(res, list):
        count = len(res)
    
    if status == 200:
        print(f"PASS: {name} ({path}) -> HTTP 200 (count: {count})")
    else:
        print(f"FAIL: {name} ({path}) -> HTTP {status}: {res}")
        all_passed = False

# Test Login Invalid Credentials
print("\n--- Testing Authentication: Invalid Credentials ---")
status, res = post("/api/v1/auth/login/", {"phone_or_email": "invalid@oyopasal.com", "password": "wrongpassword123"})
if status in [400, 401]:
    print(f"PASS: Invalid credentials correctly rejected with HTTP {status}: {res}")
else:
    print(f"FAIL: Invalid credentials returned HTTP {status}: {res}")
    all_passed = False

# Test Login Demo Quick Login
print("\n--- Testing Authentication: Demo Quick Login ---")
status, res = post("/api/v1/auth/login/", {"phone_or_email": "customer@oyopasal.com", "demo_quick_login": True})
token = None
if status == 200 and "token" in res:
    token = res["token"]
    user = res.get("user", {})
    print(f"PASS: Demo quick login succeeded with HTTP 200, user: {user.get('email')} (role: {user.get('role')})")
else:
    print(f"FAIL: Demo quick login returned HTTP {status}: {res}")
    all_passed = False

# Test Authenticated Cart Item addition
if token:
    print("\n--- Testing Authenticated Operations (Cart & Wishlist) ---")
    _, prod_res = get("/api/v1/products/")
    real_prod_id = prod_res['results'][0]['id'] if prod_res.get('results') else None
    if real_prod_id:
        status, res = post("/api/v1/cart/items/", {"product_id": real_prod_id, "quantity": 1}, token=token)
        print(f"Cart add item ({real_prod_id}) -> HTTP {status}: item_count={res.get('item_count') if isinstance(res, dict) else res}")
        
        status, res = post("/api/v1/wishlist/toggle/", {"product_id": real_prod_id}, token=token)
        print(f"Wishlist toggle ({real_prod_id}) -> HTTP {status}: is_wishlisted={res.get('is_wishlisted') if isinstance(res, dict) else res}")
        
        status, res = get("/api/v1/wishlist/", token=token)
        print(f"Wishlist list (authenticated) -> HTTP {status}: count={res.get('count')}")
        
        status, res = get("/api/v1/cart/", token=token)
        print(f"Cart list (authenticated) -> HTTP {status}: item_count={res.get('item_count')}, total={res.get('total')}")

if all_passed:
    print("\nALL ENDPOINT TESTS PASSED SUCCESSFULLY!")
else:
    print("\nSOME TESTS FAILED.")
    sys.exit(1)
