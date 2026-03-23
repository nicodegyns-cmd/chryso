#!/usr/bin/env python3
import re
import glob
import os

# Define placeholder replacements for each file
replacements = {
    'pages/api/admin/analytics/[id].js': [
        ('WHERE id = ?', 'WHERE id = $1'),
    ],
    'pages/api/admin/activities/[id].js': [
        ('WHERE id = ?', 'WHERE id = $1'),
    ],
    'pages/api/admin/activities/[id]/send.js': [
        ('WHERE id = ?', 'WHERE id = $1'),
    ],
    'pages/api/admin/prestations/generate.js': [
        ('WHERE id = ? LIMIT 1', 'WHERE id = $1 LIMIT 1'),
        ('WHERE analytic_id = ?', 'WHERE analytic_id = $1'),
    ],
    'pages/api/admin/prestations/[id].js': [
        ('WHERE id = ?', 'WHERE id = $1'),
        ('WHERE invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 1', 'WHERE invoice_number LIKE $1 ORDER BY invoice_number DESC LIMIT 1'),
        ('UPDATE prestations SET invoice_number = ? WHERE id = ?', 'UPDATE prestations SET invoice_number = $1 WHERE id = $2'),
        ('WHERE request_ref LIKE ? ORDER BY request_ref DESC LIMIT 1', 'WHERE request_ref LIKE $1 ORDER BY request_ref DESC LIMIT 1'),
        ('UPDATE prestations SET request_ref = ? WHERE id = ?', 'UPDATE prestations SET request_ref = $1 WHERE id = $2'),
        ('WHERE analytic_id = ? ORDER BY date DESC', 'WHERE analytic_id = $1 ORDER BY date DESC'),
        ('WHERE analytic_id = ? AND LOWER(pay_type) LIKE', 'WHERE analytic_id = $1 AND LOWER(pay_type) LIKE'),
        ('UPDATE prestations SET pdf_url = ? WHERE id = ?', 'UPDATE prestations SET pdf_url = $1 WHERE id = $2'),
        ('UPDATE prestations SET ${updates.join(\', \')} WHERE id = ?', 'UPDATE prestations SET ${updates.join(\', \')} WHERE id = $' + '1'),
    ],
    'pages/api/admin/users/[id].js': [
        ('WHERE id = ?', 'WHERE id = $1'),
    ],
}

def fix_file(filepath):
    if not os.path.exists(filepath):
        print(f"⚠️  File not found: {filepath}")
        return False
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    if filepath in replacements:
        for old, new in replacements[filepath]:
            content = content.replace(old, new)
    
    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✅ Fixed: {filepath}")
        return True
    else:
        print(f"⏭️  No changes: {filepath}")
        return False

if __name__ == '__main__':
    modified = 0
    for filepath in replacements.keys():
        if fix_file(filepath):
            modified += 1
    
    print(f"\n✅ Modified {modified} files")
