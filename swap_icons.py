import os
import re

directory = '.'

# Favorites is currently FIRST, notifications is SECOND. We want to swap them.
pattern = re.compile(
    r'(<div class="top-bar-item favorites".*?</div>)\s*(<div class="top-bar-item notifications-container".*?</div>\s*</div>\s*</div>)',
    re.DOTALL
)

for filename in os.listdir(directory):
    if filename.endswith('.html'):
        filepath = os.path.join(directory, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Put notifications (\2) before favorites (\1)
        new_content = pattern.sub(r'\2\n                \1', content)
        
        if content != new_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f'Updated {filename}')
