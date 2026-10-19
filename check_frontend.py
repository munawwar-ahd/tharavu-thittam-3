import requests
r = requests.get('http://127.0.0.1:5173', timeout=10)
print('Status:', r.status_code)
print('Content length:', len(r.text))
print('Has root div:', '<div id="root">' in r.text)
print('Has script:', 'type="module"' in r.text or 'src=' in r.text)

# Save to file to avoid encoding issues
with open('frontend_response.html', 'w', encoding='utf-8') as f:
    f.write(r.text[:3000])
print('Saved to frontend_response.html')