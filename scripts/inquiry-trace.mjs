// Observe only inquiry POST status and safe errors. Never print raw trace events,
// request headers, cookies, form fields, provider responses or credential values.
import {spawn} from 'node:child_process';
const host='https://auxedu.com';
const cf=await fetch('https://api.cloudflare.com/client/v4/accounts/2ac862d7c1f865935d185df59e7bd719/pages/projects/auxesis-education',{headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN}});if(!cf.ok)throw Error('Trace project lookup HTTP '+cf.status);const project=(await cf.json()).result;
async function status(state,description){const r=await fetch('https://api.github.com/repos/Amandadsouza77/auxesis-education/statuses/'+process.env.GITHUB_SHA,{method:'POST',headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({state,context:'Inquiry diagnostic stream',description})});if(!r.ok)throw Error('Trace status update HTTP '+r.status);}
await status('pending','Starting inquiry-only diagnostic stream');
const child=spawn('npx',['--yes','wrangler@4','pages','deployment','tail',project.canonical_deployment.id,'--project-name=auxesis-education','--format=json'],{env:process.env,detached:true,stdio:['ignore','pipe','pipe']});
let buffer='',record='',seen=false,actual=0;
child.stderr.on('data',()=>{});
child.stdout.on('data',chunk=>{buffer+=chunk;let pos;while((pos=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,pos);buffer=buffer.slice(pos+1);if(!record&&!line.trim().startsWith('{'))continue;record+=line+'\n';let data;try{data=JSON.parse(record)}catch{continue;}record='';
 let path;try{path=new URL(data.event?.request?.url).pathname;}catch{continue;}
 if(path!=='/api/enquiry'||data.event.request.method!=='POST')continue;
 const parsed=[];for(const log of data.logs||[])for(const message of log.message||[]){try{const o=JSON.parse(message);if(o.event==='inquiry_delivery_failure')parsed.push({stage:o.stage,status:o.status,code:o.code,reason:o.reason,domainNotVerified:o.domainNotVerified,testingRestriction:o.testingRestriction,apiKeyProblem:o.apiKeyProblem});}catch{}}
 console.log('::notice::'+JSON.stringify({requestTime:data.eventTimestamp,outcome:data.outcome,http:data.event.response?.status,exceptionTypes:(data.exceptions||[]).map(e=>e.name),exceptionCategories:(data.exceptions||[]).map(e=>/never generate a response/i.test(e.message)?'unresolved_promise':/I\/O.*different request|I\/O on behalf/i.test(e.message)?'io_scope':/body.*used|body.*consum/i.test(e.message)?'body_consumed':/invalid.*url/i.test(e.message)?'invalid_url':'unclassified'),diagnostics:parsed}));
 if(!seen){seen=true;status('pending','Listening: ready for one owner test inquiry').catch(()=>{});}else{actual++;setTimeout(()=>{try{process.kill(-child.pid,'SIGINT')}catch{}},1500);}
}});
const probe=setTimeout(async()=>{try{await fetch(host+'/api/enquiry',{method:'POST',headers:{Origin:host,'Content-Type':'application/json'},body:'{}'});}catch{}},15000);
const stop=setTimeout(()=>{try{process.kill(-child.pid,'SIGINT')}catch{}},600000);
await new Promise(resolve=>child.on('exit',async code=>{clearTimeout(probe);clearTimeout(stop);console.log('::notice::'+JSON.stringify({traceConnected:seen,additionalPostsObserved:actual,exit:code}));await status(seen?'success':'failure',seen?'Inquiry diagnostic stream complete':'Could not connect inquiry diagnostic stream').catch(()=>{});resolve();}));
if(!seen)process.exitCode=1;
