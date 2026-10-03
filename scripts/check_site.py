"""Check generated routes, local links, fragment targets, assets, and content slots."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import json
ROOT=Path(__file__).resolve().parents[1];D=ROOT/'dist'
class Page(HTMLParser):
    def __init__(self):super().__init__();self.links=[];self.ids=set();self.main=0
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if attrs.get('id'): self.ids.add(attrs['id'])
        if tag=='main': self.main+=1
        for key in ['src','href']:
            if key in attrs:self.links.append(attrs[key])
pages={}
for file in D.rglob('*.html'):
    p=Page();p.feed(file.read_text());pages[file]=p
errors=[];count=0
for file,page in pages.items():
    if 'admin' not in file.parts and page.main!=1:errors.append(f'{file}: expected one main')
    for link in page.links:
        url=urlsplit(link)
        if url.scheme or url.netloc:continue
        target=D/unquote(url.path).lstrip('/') if url.path.startswith('/') else file.parent/unquote(url.path)
        if not url.path:target=file
        if target.is_dir():target=target/'index.html'
        if not target.is_file():errors.append(f'{file.relative_to(D)}: missing {link}')
        elif url.fragment and target in pages and unquote(url.fragment) not in pages[target].ids:errors.append(f'{file.relative_to(D)}: missing fragment {link}')
        count+=1
    if '%%COPY:' in file.read_text():errors.append(f'{file}: unresolved slots')
config=json.loads((D/'admin/config.yml').read_text())
for collection in config['collections']:
    for item in collection['files']:
        if not (ROOT/item['file']).is_file():errors.append('CMS source missing: '+item['file'])
if errors:raise SystemExit('\n'.join(errors))
print(f'PASS: {len(pages)} HTML files, {count} local links/assets/fragments, all CMS sources.')
