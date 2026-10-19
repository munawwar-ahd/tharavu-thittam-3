import requests
try:
    r = requests.get('http://127.0.0.1:5173', timeout=10)
    print('Status:', r.status_code)
    print('Root div:', '<div id="root"></div>' in r.text)
    has_script = 'src="/src/main.tsx"' in r.text or 'src="/src/main.tsx?' in r.text
    print('Script tag:', has_script)
    if not has_script:
        # Find script tags
        import re
        scripts = re.findall(r'<script[^>]*src="([^"]*)"', r.text)
        print('Script tags found:', scripts)
except Exception as e:
    print('Error:', e)