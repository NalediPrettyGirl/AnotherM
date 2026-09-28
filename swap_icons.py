import os
import re

directory = r'c:\Users\User\Documents\dresses - Copy'

# Regex to match the notifications block and favorites block
# Notifications block starts with <div class="top-bar-item notifications-container"
# and ends after its corresponding closing div (which has two inner divs)
pattern = re.compile(
    r'(<div class="top-bar-item notifications-container".*?</div>\s*</div>\s*</div>)\s*(<div class="top-bar-item favorites".*?</div>)',
    re.DOTALL
)

for filename in os.listdir(directory):
    if filename.endswith('.html'):
        filepath = os.path.join(directory, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content = pattern.sub(r'\2\n                \1', content)
        
        if content != new_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f'Updated {filename}')
