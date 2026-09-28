import os
import glob

directory = r'c:\Users\User\Documents\dresses - Copy'

for filepath in glob.glob(os.path.join(directory, '*.html')):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replacements
    content = content.replace('Treasured', 'Another Moment')
    content = content.replace('TREASURED', 'ANOTHER MOMENT')
    content = content.replace('info@treasured.co.za', 'info@anothermoment.co.za')
    
    # Social links
    content = content.replace('<a href=\"#\" class=\"social-icon\"><i class=\"fa-brands fa-instagram\"></i></a>', '<a href=\"https://www.instagram.com/anothermoment_attire/\" target=\"_blank\" class=\"social-icon\"><i class=\"fa-brands fa-instagram\"></i></a>')
    content = content.replace('<a href=\"#\" class=\"social-icon\"><i class=\"fa-brands fa-tiktok\"></i></a>', '<a href=\"https://www.tiktok.com/@anothermoment_attire\" target=\"_blank\" class=\"social-icon\"><i class=\"fa-brands fa-tiktok\"></i></a>')
    content = content.replace('<a href=\"#\" class=\"social-icon\"><i class=\"fa-brands fa-facebook-f\"></i></a>', '<a href=\"https://www.facebook.com/search/top?q=Another%20Moment%20-%20Events%20Attire%20Marketplace\" target=\"_blank\" class=\"social-icon\"><i class=\"fa-brands fa-facebook-f\"></i></a>')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print('Replacements complete.')
