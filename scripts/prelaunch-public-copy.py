"""Patch only approved public copy in an already verified runtime package.

This deliberately does not rebuild or replace the private runtime. No network,
database, configuration or deployment operations are performed.
"""
from pathlib import Path
import argparse
import html
import json
import re

ROOT = Path(__file__).resolve().parents[1]


def plain(value):
    return ' '.join(html.unescape(re.sub(r'<[^>]+>', '', value)).split())


def patch_page(source, changes, page):
    for change in changes:
        before, after = plain(change['original']), plain(change['replacement'])
        matches = []
        def paragraph(match):
            text = plain(match[2])
            if text in (before, after):
                matches.append(text)
                return match[1] + html.escape(change['replacement'], quote=False) + match[3]
            return match[0]
        source = re.sub(r'(<p\b[^>]*>)(.*?)(</p>)', paragraph, source, flags=re.S)
        if len(matches) != 1:
            raise ValueError(f"{page}: expected one paragraph for {change['id']}, found {len(matches)}")
    # Remove public navigation only. Owner review management and portal routes remain.
    for tag in ('header', 'footer'):
        def navigation(match):
            return re.sub(r'<a\b[^>]*href=[\"\']/portal/[\"\'][^>]*>.*?</a>', '', match[0], flags=re.S)
        source = re.sub(fr'<{tag}\b[^>]*>.*?</{tag}>', navigation, source, flags=re.S)
    if page == 'how-tutoring-works':
        source, removed = re.subn(
            r'<article>\s*<span>05</span>\s*<div>\s*<h2>Your Auxesis Portal</h2>.*?</div>\s*</article>',
            '', source, flags=re.S)
        source, renumbered = re.subn(
            r'(<article>\s*<span>)(?:05|06)(</span>\s*<div>\s*<h2>Ongoing tutoring</h2>)',
            r'\g<1>05\2', source)
        if removed > 1 or renumbered != 1 or 'Your Auxesis Portal' in source:
            raise ValueError('Unexpected onboarding markup; no files written')
    return source


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('runtime_dist', type=Path)
    args = parser.parse_args()
    target = args.runtime_dist.resolve()
    if target == (ROOT / 'dist').resolve():
        raise ValueError('Use the verified private runtime dist, not the ordinary build')
    changes = json.loads((ROOT / 'docs/PRELAUNCH_PORTAL_COPY_CHANGES.json').read_text())
    by_page = {}
    for change in changes:
        by_page.setdefault(change['page'], []).append(change)
    # All preconditions pass before any file is written.
    pending = {}
    for file in target.rglob('*.html'):
        page = file.parent.name if file.name == 'index.html' else file.stem
        pending[file] = patch_page(file.read_text(), by_page.get(page, []), page)
    for page in by_page:
        if target / page / 'index.html' not in pending:
            raise ValueError(f'Missing expected public route: {page}')
    for file, output in pending.items():
        file.write_text(output)
    print(f'Patched public copy in {len(pending)} HTML files; runtime code and assets retained.')


if __name__ == '__main__':
    main()
