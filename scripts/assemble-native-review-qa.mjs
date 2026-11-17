// Local candidate assembly only. Never invokes a release script or provider API.
import {readFileSync,writeFileSync,readdirSync,statSync,mkdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {prepareNativeInquiry} from './prepare-native-inquiry.mjs';
import {applyPublicCopy} from './approved-public-copy.mjs';
import {addInternationalRoutes,addOntarioRoutes} from './international-public-wrapper.mjs';
const root=resolve(process.env.QA_NATIVE_ROOT||'work/staging-deployment/runtime');
const sha=b=>createHash('sha256').update(b).digest('hex');
const files=dir=>readdirSync(dir).flatMap(n=>{const p=resolve(dir,n);return statSync(p).isDirectory()?files(p):[p]});
const core=()=>Object.fromEntries([root+'/staging-entry.js',...files(root+'/cloudflare')].sort().map(p=>[relative(root,p),sha(readFileSync(p))]));
const before=core();
await build({entryPoints:[root+'/staging-entry.js'],bundle:true,format:'esm',outfile:root+'/dist/_worker.js'});
prepareNativeInquiry(root);
const app=root+'/dist/app.js';writeFileSync(app,readFileSync(app,'utf8').replace('Amanda will be in touch to discuss the student’s needs and tutoring arrangements, usually within 24–48 hours.','Amanda normally replies within 24 hours on business days, excluding Canadian statutory holidays.'));
const wrapper=addOntarioRoutes(addInternationalRoutes(readFileSync('cloudflare/public-site-worker.js','utf8'),JSON.parse(readFileSync('content/international-pages.json'))),JSON.parse(readFileSync('content/ontario-pages.json')));
writeFileSync(root+'/inquiry/cloudflare/public-site-worker.js',wrapper);
writeFileSync(root+'/inquiry-entry.js',"import nativeWorker from './staging-entry.js';\nimport {withInquiry} from './inquiry/cloudflare/inquiry-worker.js';\nimport {withPublicSite} from './inquiry/cloudflare/public-site-worker.js';\nexport default withPublicSite(withInquiry(nativeWorker));\n");
applyPublicCopy(root+'/dist');
const css=root+'/dist/styles.css';writeFileSync(css,readFileSync(css,'utf8')+'\n.field select{min-width:0;max-width:100%}.field-hint{font-weight:400;font-size:.85rem}\n');
await build({entryPoints:['lib/time-zones.js'],bundle:true,format:'iife',globalName:'AuxesisTimeZones',outfile:root+'/dist/time-zones.js'});
for(const name of ['robots.txt','sitemap.xml']){let s=readFileSync(root+'/dist/'+name,'utf8').replaceAll('https://auxesis-education.pages.dev','https://auxedu.com');if(name==='robots.txt')s=s.replace('Disallow: /api/','Disallow: /api/\nDisallow: /portal/\nDisallow: /resources/');writeFileSync(root+'/dist/'+name,s);}
await build({entryPoints:[root+'/inquiry-entry.js'],bundle:true,format:'esm',outfile:root+'/dist/_worker.js'});
if(JSON.stringify(before)!==JSON.stringify(core()))throw Error('Native source was modified');
mkdirSync('work/native-review-qa',{recursive:true});
const evidence={nativeSourceUnchanged:true,nativeSourceHash:sha(JSON.stringify(before)),workerHash:sha(readFileSync(root+'/dist/_worker.js')),staticAssetHashes:Object.fromEntries(files(root+'/dist').filter(p=>!p.endsWith('/_worker.js')).sort().map(p=>[relative(root+'/dist',p),sha(readFileSync(p))])),deployment:false};
writeFileSync('work/native-review-qa/assembly.json',JSON.stringify(evidence,null,2));
console.log(JSON.stringify({nativeSourceUnchanged:true,nativeSourceHash:evidence.nativeSourceHash,workerHash:evidence.workerHash,staticAssets:Object.keys(evidence.staticAssetHashes).length,deployment:false}));
