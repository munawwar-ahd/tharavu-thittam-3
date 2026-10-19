import requests
try:
    r = requests.get('http://127.0.0.1:5173/src/i18n.tsx', timeout=10)
    print('i18n.tsx status:', r.status_code)
    with open('i18n_response.js', 'w', encoding='utf-8') as f:
        f.write(r.text[:2000])
    print('Saved to i18n_response.js')
except Exception as e:
    print('Error:', e)