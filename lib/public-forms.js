const SERVICE='https://auxesis-portal-service.floot.app/_api/public/forms';
const SITE='https://auxesis-education.pages.dev';
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
async function client(request){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(request.headers.get('CF-Connecting-IP')||'unknown'));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function publicForm(request,kind){
  let stage='request';
  try{
    if(!['enquiry','review'].includes(kind))return json({error:'This form is not available.'},404);
    if(request.method==='POST'&&request.headers.get('Origin')!==SITE)return json({error:'Please submit this form from the Auxesis website.'},403);
    stage='client';
    const headers={'x-auxesis-client':await client(request)};
    let body;
    if(request.method==='POST'){
      if(request.headers.get('Content-Type')?.split(';')[0]!=='application/json')return json({error:'Send JSON data.'},415);
      body=await request.text();if(body.length>24000)return json({error:'Submission is too long.'},413);
      headers['Content-Type']='application/json';headers.Origin=SITE;
    }
    stage='service';
    const r=await fetch(SERVICE+'?kind='+kind,{method:request.method,headers,body,redirect:'error'});
    stage='response';
    let data;try{data=await r.json();}catch{return json({ready:false,error:'The form is temporarily unavailable. Please email Amanda directly.',stage},503);}
    return json(data,r.status);
  }catch{return json({ready:false,error:'The form is temporarily unavailable. Please email Amanda directly.',stage},503);}
}
