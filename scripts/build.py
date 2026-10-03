"""Build the approved site from shared templates and editable JSON. Python 3.10+, no packages."""
from pathlib import Path
from html import escape
from urllib.parse import urlparse
import json, re, shutil, argparse

ROOT = Path(__file__).resolve().parents[1]
def read(path): return json.loads((ROOT / path).read_text(encoding='utf-8'))
def e(value): return escape(str(value), quote=True)
def local_asset(value):
    if not isinstance(value, str) or not value.startswith('/assets/') or '..' in value or any(c in value for c in '\\<>\"\n\r'):
        raise ValueError('Images must be uploaded to /assets/.')
    if not (ROOT / 'public' / value.lstrip('/')).is_file():
        raise ValueError('Missing image: ' + value)
    return value
def validate_url(value):
    url = urlparse(value)
    if url.scheme != 'https' or not url.netloc or url.username or url.password or url.query or url.fragment or url.path not in ('', '/'):
        raise ValueError('site_url must be an HTTPS origin, such as https://auxedu.com.')
    return value.rstrip('/')
def recommendation_cards(items, short=False):
    cards=[]
    for item in items:
        quote=item.get('short_quote',item['quote']) if short else item['quote']
        cards.append(f'<figure class="recommendation-card"><p class="eyebrow">{e(item["topic"])}</p><blockquote><p>“{e(quote)}”</p></blockquote><figcaption><strong>{e(item["name"])}</strong><span>{e(item["relationship"])}</span><span class="recommendation-source">LinkedIn recommendation · <time datetime="{e(item["date"])}">{e(item["display_date"])}</time></span></figcaption></figure>')
    return '<div class="recommendation-grid'+(' home-recommendations' if short else '')+'">'+''.join(cards)+'</div>'
def render(template, data, defaults):
    values = {b['key']: b['text'] for b in data['blocks']}
    def replace(match):
        key = match[1]
        if key not in defaults or key not in values: raise ValueError('Missing content block: ' + key)
        value = values[key]
        if not isinstance(value,str): raise ValueError('Text block must be a string: '+key)
        return defaults[key]['raw'] if value == defaults[key]['text'] else e(value).replace('\n', '<br>')
    return re.sub(r'%%COPY:([^%]+)%%', replace, template)

def visual_grouping(html):
    html = html.replace('<p>Less memorising. More understanding.</p>', '<p class="learning-statement"><span>Less memorising.</span> <span>More understanding.</span></p>')
    phrases = {
        'Understand more.<br>Think independently.': '<span class="hero-line">Understand more.</span> <span class="hero-line">Think independently.</span>',
        '<h1>Why Auxesis exists</h1>': '<h1 class="compact-title">Why Auxesis exists</h1>',
        'Science, by programme.': 'Science, <span class="keep-together">by programme.</span>',
        'Strong foundations matter.': 'Strong <span class="keep-together">foundations matter.</span>',
        'Biology, education and professional certification.': 'Biology, education and <span class="keep-together">professional certification.</span>',
        'Live, one-to-one sessions.': 'Live, <span class="keep-together">one-to-one sessions.</span>',
        'Share your experience.': 'Share <span class="keep-together">your experience.</span>',
        '<h2>Parent conversation</h2>': '<h2><span class="keep-together">Parent conversation</span></h2>',
        '<h1>Information used only for tutoring and related administration.</h1>': '<h1 class="privacy-title">Information used only for tutoring and <span class="keep-together">related administration.</span></h1>',
    }
    # Restrict grouping to headings; metadata and body copy are not changed.
    import re
    def group_heading(match):
        value = match.group(0)
        for original, grouped in phrases.items():
            value = value.replace(original, grouped)
        return value
    return re.sub(r'<h[123]\b[^>]*>.*?</h[123]>', group_heading, html)

def build():
    settings=read('content/settings.json'); defaults=read('templates/default-copy.json'); routes=read('templates/routes.json')
    site_url=validate_url(settings['site_url']) if settings['site_url'] else ''
    production=settings.get('production',False)
    if production and not site_url: raise ValueError('Set site_url before enabling production.')
    if production and not settings.get('public_email'): raise ValueError('Set public_email before enabling production.')
    logo=local_asset(settings.get('logo','/assets/logo.png'))
    portrait=local_asset(settings['portrait']) if settings.get('portrait') else ''
    rec=read('content/recommendations.json')
    if not re.match(r'^https://(www\.)?linkedin\.com/',rec['verification_url']): raise ValueError('Use a LinkedIn HTTPS verification URL.')
    if len({x['id'] for x in rec['recommendations']}) != len(rec['recommendations']): raise ValueError('Recommendation IDs must be unique.')
    groups={g:recommendation_cards([x for x in rec['recommendations'] if x['group']==g]) for g in ['parents','students','colleagues']}
    groups['home']=recommendation_cards([x for x in rec['recommendations'] if x['id'] in ['macel','lynne','vy']],short=True)
    shared={name:render((ROOT/f'templates/components/{name}.html').read_text(),read(f'content/{name}.json'),defaults) for name in ['header','footer','cta']}
    target=ROOT/'dist'
    if target.exists(): shutil.rmtree(target)
    shutil.copytree(ROOT/'public',target)
    for route in routes:
        data=read('content/pages/'+route['name']+'.json')
        body=render((ROOT/f'templates/pages/{route["name"]}.html').read_text(),data,defaults)
        doc=shared['header']+'<main id="main">'+body+'</main>'+shared['footer']
        doc=doc.replace('%%TITLE%%',e(data['title'])).replace('%%DESCRIPTION%%',e(data['description']))
        doc=doc.replace('%%COMPONENT:cta%%',shared['cta']).replace('%%VERIFY_URL%%',e(rec['verification_url']))
        for group,cards in groups.items(): doc=doc.replace('%%CARDS:'+group+'%%',cards)
        # Active navigation comes from the requested route, exactly as in the original shell.
        if route['route'] in ['/','/about-auxesis/','/about-amanda/','/how-tutoring-works/','/subjects-programmes/','/recommendations/','/enquire/']:
            doc=re.sub(r'(<nav id="main-navigation"[^>]*>.*?href="'+re.escape(route['route'])+r'")>',r'\1 aria-current="page">',doc,count=1,flags=re.S)
        if logo!='/assets/logo.png': doc=doc.replace('src="/assets/logo.png"',f'src="{e(logo)}"')
        if portrait:
            doc=re.sub(r'<figure class="portrait-placeholder".*?</figure>',f'<figure class="portrait-placeholder"><img class="amanda-photo" src="{e(portrait)}" alt="{e(settings["portrait_alt"])}"></figure>',doc,flags=re.S)
        if settings.get('public_email'):
            address=settings['public_email']
            if not re.fullmatch(r'[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+',address): raise ValueError('Enter a valid public email.')
            doc=doc.replace('[PLACEHOLDER: Public Auxesis Education business email address.]',f'<a href="mailto:{e(address)}">{e(address)}</a>')
        else:
            doc=doc.replace('[PLACEHOLDER: Public Auxesis Education business email address.]',f'<a href="{e(rec["verification_url"])}">Contact Amanda on LinkedIn</a>')
        if production:
            doc=doc.replace('<div class="prototype-banner">Private website prototype · No analytics or advertising trackers</div>','')
            doc=doc.replace('<meta name="robots" content="noindex,nofollow">','<meta name="robots" content="index,follow">' if route['name']!='404' else '<meta name="robots" content="noindex">')
            doc=doc.replace('</head>',f'<link rel="canonical" href="{e(site_url+route["route"])}"></head>')
        # Keep the existing review UI; give its controls names for a real submission.
        doc=doc.replace('aria-label="Review text" required','aria-label="Review text" name="review" required maxlength="8000"')
        doc=doc.replace('aria-label="Relationship to Auxesis" required','aria-label="Relationship to Auxesis" name="relationship" required maxlength="200"')
        doc=doc.replace('aria-label="Preferred public name or identification"','aria-label="Preferred public name or identification" name="public_name" maxlength="200"')
        doc=doc.replace('<input type="checkbox" required> Permission to publish','<input type="checkbox" name="consent" required> Permission to publish')
        doc=re.sub(r'(<form[^>]*id="(?:enquiry-form|review-form)"[^>]*>)',r'\1<div class="bot-field" hidden aria-hidden="true"><label>Leave empty<input name="website" tabindex="-1" autocomplete="off"></label></div>',doc)
        # Original programme links use short aliases; normalize them in app.js without rewriting content.
        if re.search(r'%%[A-Z_]+',doc): raise ValueError('Unresolved template in '+route['name'])
        doc=visual_grouping(doc)
        out=target/route['path'];out.parent.mkdir(parents=True,exist_ok=True);out.write_text(doc,encoding='utf-8')
    config={'turnstileSiteKey':settings.get('turnstile_site_key','')}
    (target/'site-config.js').write_text('window.AUXESIS='+json.dumps(config)+';\n')
    for file in target.rglob('*.html'):
        if 'admin' not in file.parts: file.write_text(file.read_text().replace('<script defer src="/app.js">','<script defer src="/site-config.js"></script><script defer src="/app.js">'))
    from cms_config import make_config
    (target/'admin/config.yml').write_text(json.dumps(make_config(settings,routes),ensure_ascii=False,indent=2)+'\n')
    preview={'defaults':defaults,'routes':routes,'shared_templates':{n:(ROOT/f'templates/components/{n}.html').read_text() for n in shared},'shared_content':{n:read(f'content/{n}.json') for n in shared},'templates':{r['name']:(ROOT/f'templates/pages/{r["name"]}.html').read_text() for r in routes},'pages':{r['name']:read(f'content/pages/{r["name"]}.json') for r in routes},'recommendations':rec,'settings':settings}
    (target/'admin/preview-data.json').write_text(json.dumps(preview,ensure_ascii=False))
    (target/'_routes.json').write_text(json.dumps({'version':1,'include':['/api/*'],'exclude':[]}))
    if production:
        (target/'robots.txt').write_text(f'User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nSitemap: {site_url}/sitemap.xml\n')
        (target/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join('<url><loc>'+e(site_url+r['route'])+'</loc></url>' for r in routes if r['name']!='404')+'</urlset>')
    else: (target/'robots.txt').write_text('User-agent: *\nDisallow: /\n')
    print(f'Built {len(routes)-1} pages, 404, assets, CMS and Cloudflare configuration. Mode: '+('production' if production else 'private preview'))

if __name__=='__main__': build()
