import re

with open('css/style.css', 'r') as f:
    css = f.read()

# 1. Update :root variables
css = re.sub(r'--bg-gradient:\s*linear-gradient[^;]+;', '--bg-gradient: linear-gradient(135deg, #0b0f19 0%, #111827 100%);', css)
css = re.sub(r'--card-bg:\s*[^;]+;', '--card-bg: #1f2937;', css)
css = re.sub(r'--border-color:\s*[^;]+;', '--border-color: rgba(255, 255, 255, 0.05);', css)
css = re.sub(r'--glass-blur:\s*[^;]+;', '--glass-blur: 0px;', css)

# 2. Remove text-shadow overrides for projected-final
# We need to add an override since the text-shadow is inline in JS
override = "\n\n/* Override inline text-shadows from JS */\n#projected-final span, .sticky-header *, .ledger-card * { text-shadow: none !important; }\n"
if "/* Override inline text-shadows from JS */" not in css:
    css += override

# 3. Remove colorful neon box-shadows
css = re.sub(r'box-shadow:\s*0\s+8px\s+32px\s+0\s+rgba\(\s*6\s*,\s*182\s*,\s*212\s*,\s*0\.4\s*\);', '', css) # .ledger-card.active
css = re.sub(r'box-shadow:\s*0\s+6px\s+20px\s+rgba\(\s*6\s*,\s*182\s*,\s*212\s*,\s*0\.5\s*\);', 'box-shadow: none;', css) # .btn-ig-calc:hover
css = re.sub(r'box-shadow:\s*0\s+6px\s+20px\s+rgba\(\s*16\s*,\s*185\s*,\s*129\s*,\s*0\.5\s*\);', 'box-shadow: none;', css) # .btn-ig-approve:hover

with open('css/style.css', 'w') as f:
    f.write(css)
