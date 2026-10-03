from pathlib import Path

def build_portal(root,target):
    routes=['portal','portal/dashboard','portal/lessons','portal/lesson','portal/messages','portal/account','portal/reports','portal/billing','portal/invoice','portal/calendar','portal/students','portal/student','portal/onboarding','resources','resources/resource','resources/manage']
    for route in routes:
        title='Resource Library' if route.startswith('resources') else 'Portal'
        html=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>{title} | Auxesis Education</title><meta name="description" content="Private lesson records and resources for Auxesis students and families."><link rel="icon" href="/assets/favicon.png"><link rel="preload" href="/assets/Fraunces.ttf" as="font" type="font/ttf" crossorigin><link rel="preload" href="/assets/Figtree.ttf" as="font" type="font/ttf" crossorigin><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/portal.css"><script defer src="/portal.js"></script></head><body><a class="skip-link" href="#main">Skip to content</a><div id="portal-app"><main id="main" class="signin-wrap"><h1>Auxesis Portal</h1><p>Loading your portal…</p></main></div><noscript><div class="wrap"><h1>Auxesis Portal</h1><p>Please enable JavaScript to sign in to your portal.</p><a href="/">Return to the website</a></div></noscript></body></html>'''
        p=target/route/'index.html';p.parent.mkdir(parents=True,exist_ok=True);p.write_text(html)
