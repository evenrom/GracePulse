import re

with open('css/style.css', 'r') as f:
    css = f.read()

# 1. Update inputs
css = re.sub(
    r'\.input-edit\s*\{[^}]*\}',
    r'.input-edit {\n  width: 100px;\n  padding: 0.25rem 0.5rem;\n  background: #0b0f19;\n  color: #ffffff;\n  border: 1px solid #4b5563;\n  border-radius: 4px;\n  font-family: var(--font-body);\n  font-size: 0.9rem;\n  text-align: left;\n}',
    css
)

css = re.sub(
    r'\.ig-input-group input\s*\{[^}]*\}',
    r'.ig-input-group input {\n  width: 100%;\n  padding: 0.75rem;\n  background: #0b0f19;\n  color: #ffffff;\n  border: 1px solid #4b5563;\n  border-radius: 8px;\n  font-size: 1rem;\n  transition: all 0.2s;\n}',
    css
)

# 2. Refactor buttons (remove heavy gradients/box-shadows, use flat solid colors)
css = re.sub(r'transform: translateY\(1px\);', 'background-color: inherit; opacity: 0.9;', css) # modify active state to avoid layout shift

css = re.sub(
    r'\.btn-approve\s*\{[^}]*\}',
    r'.btn-approve {\n  background: var(--success);\n  color: white;\n  border: none;\n  padding: 0.75rem 1.5rem;\n  border-radius: 8px;\n  font-weight: 600;\n  font-family: var(--font-heading);\n  font-size: 1rem;\n  width: 100%;\n  cursor: pointer;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  gap: 0.5rem;\n  transition: all 0.2s;\n}',
    css
)
css = re.sub(r'\.btn-approve:active\s*\{[^}]*\}', '.btn-approve:active { background: #047857; }', css)

css = re.sub(
    r'\.btn-save\s*\{[^}]*\}',
    r'.btn-save {\n  background: var(--accent-cyan);\n  color: white;\n  border: none;\n  padding: 0.75rem 1.5rem;\n  border-radius: 8px;\n  font-weight: 600;\n  font-family: var(--font-heading);\n  font-size: 1rem;\n  width: 100%;\n  cursor: pointer;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  gap: 0.5rem;\n  transition: all 0.2s;\n}',
    css
)
css = re.sub(r'\.btn-save:active\s*\{[^}]*\}', '.btn-save:active { background: #0369a1; }', css)

css = re.sub(
    r'\.btn-ig-calc\s*\{[^}]*\}',
    r'.btn-ig-calc {\n  background: var(--primary);\n  color: white;\n  border: none;\n  padding: 0.75rem 1.5rem;\n  border-radius: 8px;\n  font-weight: 600;\n  width: 100%;\n  cursor: pointer;\n  margin-bottom: 1.25rem;\n  transition: all 0.2s;\n  font-family: var(--font-heading);\n}',
    css
)
css = re.sub(r'\.btn-ig-calc:active\s*\{[^}]*\}', '.btn-ig-calc:active { background: var(--primary-light); }', css)

css = re.sub(
    r'\.btn-ig-approve\s*\{[^}]*\}',
    r'.btn-ig-approve {\n  background: var(--success);\n  color: white;\n  border: none;\n  padding: 0.75rem 1.5rem;\n  border-radius: 8px;\n  font-weight: 600;\n  width: 100%;\n  cursor: pointer;\n  transition: all 0.2s;\n  font-family: var(--font-heading);\n}',
    css
)
css = re.sub(r'\.btn-ig-approve:active\s*\{[^}]*\}', '.btn-ig-approve:active { background: #047857; }', css)


# 3. Polish the slide-up bottom sheet modal (solid dark matte background)
css = re.sub(
    r'\.bottom-sheet\s*\{[^}]*\}',
    r'.bottom-sheet {\n  position: fixed;\n  bottom: 0;\n  left: 0;\n  right: 0;\n  background: #1f2937;\n  border: 1px solid rgba(255, 255, 255, 0.05);\n  border-bottom: none;\n  border-top-left-radius: 16px;\n  border-top-right-radius: 16px;\n  padding: 1.5rem;\n  z-index: 900;\n  transition: transform 0.3s ease-in-out;\n  transform: translateY(100%);\n}',
    css
)

css = re.sub(
    r'\.bottom-sheet-overlay\s*\{[^}]*\}',
    r'.bottom-sheet-overlay {\n  position: fixed;\n  top: 0;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  background: rgba(11, 15, 25, 0.8);\n  z-index: 899;\n}',
    css
)


with open('css/style.css', 'w') as f:
    f.write(css)
