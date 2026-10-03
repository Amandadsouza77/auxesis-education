"""One-time account configuration; no secrets are written here."""
from pathlib import Path
import argparse,json,re
from build import validate_url
parser=argparse.ArgumentParser()
parser.add_argument('--site-url',required=True);parser.add_argument('--github-repository',required=True)
parser.add_argument('--email',required=True);parser.add_argument('--branch',default='main')
parser.add_argument('--turnstile-site-key',default='');parser.add_argument('--launch',action='store_true')
args=parser.parse_args()
if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',args.github_repository): parser.error('Repository must be owner/name.')
path=Path(__file__).resolve().parents[1]/'content/settings.json';data=json.loads(path.read_text())
data.update(site_url=validate_url(args.site_url),github_repository=args.github_repository,public_email=args.email,github_branch=args.branch,turnstile_site_key=args.turnstile_site_key,production=args.launch)
path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');print('Saved public configuration. Add private credentials in Cloudflare, not in this file.')
