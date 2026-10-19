import requests
try:
    r = requests.get('http://127.0.0.1:5173', timeout=10)
    print('Status:', r.status_code)
    with open('served_index.html', 'w', encoding='utf-8') as f:
        f.write(r.text)
    print('Saved to served_index.html')
except Exception as e:
    print('Error:', e)