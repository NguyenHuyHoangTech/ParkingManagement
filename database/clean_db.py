import re

file_path = r'd:\GitHub\ParkingManagement\database\0_DATABASE.sql'

with open(file_path, 'r', encoding='utf-16le') as f:
    content = f.read()

# 1. Remove column definition
content = re.sub(r'\t\[max_parking_cap\] \[decimal\]\(18, 2\) NOT NULL,\n', '', content)

# 2. Remove default constraint
content = re.sub(r'ALTER TABLE \[dbo\]\.\[pricing_policies\] ADD  DEFAULT \(\(3000000\)\) FOR \[max_parking_cap\]\n?', '', content)

# 3. Fix INSERT statements
content = content.replace(', [max_parking_cap]', '')
content = re.sub(r'(CAST\([^)]+\)), (CAST\([^)]+\)), N\'ACTIVE\'', r'\1, N\'ACTIVE\'', content)

with open(file_path, 'w', encoding='utf-16le') as f:
    f.write(content)
print("Updated 0_DATABASE.sql")
