import re

files = ['login.html', 'register.html', 'vendor-register.html']
for fname in files:
    with open(fname, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove Facebook and Instagram buttons
    content = re.sub(r'\s*<button[^>]*Facebook login[^>]*>[\s\S]*?</button>', '', content)
    content = re.sub(r'\s*<button[^>]*Instagram login[^>]*>[\s\S]*?</button>', '', content)
    
    with open(fname, 'w', encoding='utf-8') as f:
        f.write(content)

print('Updated successfully')
