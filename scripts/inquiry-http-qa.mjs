// Synthetic rejection checks only: these requests cannot send email.
const valid={name:'Synthetic QA',email:'qa@example.invalid',country:'Canada',timezone:'UTC−05:00',year:'Grade 11',programme:'IB Diploma',subject:'Biology',support:'Synthetic validation only',contact:'Email',consent:true};
for(const host of ['https://auxesis-education.pages.dev','https://auxedu.com']){
 for(const data of [{},{...valid},{...valid,turnstile_token:'invalid-synthetic-token'}]){
  const r=await fetch(host+'/api/enquiry',{method:'POST',redirect:'manual',headers:{Origin:host,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(30000)});
  const raw=await r.text();let body;try{body=JSON.parse(raw)}catch{}
  console.log('::notice::'+JSON.stringify({host,check:!data.consent?'consent':data.turnstile_token?'invalid-spam-token':'missing-spam-token',http:r.status,type:r.headers.get('Content-Type'),runtime:r.headers.get('X-Auxesis-Runtime'),location:r.headers.get('Location'),error:body?.error||null,cloudflareCode:(raw.match(/Error (?:code[: ]*)?(\d{3,5})/i)||[])[1]||null}));
 }
}
