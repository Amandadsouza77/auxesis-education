// Authorized email-service smoke test to the owner only, independent of the form.
// Never log settings values, credential values, or raw provider response bodies.
const account='2ac862d7c1f865935d185df59e7bd719';
const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/auxesis-education',{redirect:'error',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN}});
if(!r.ok)throw Error('Provider configuration read HTTP '+r.status);
const d=await r.json();if(!d.success)throw Error('Provider configuration read rejected');
const v=d.result.deployment_configs.production.env_vars;
const key=v.RESEND_API_KEY?.value,sender=v.EMAIL_FROM?.value;
if(typeof key!=='string'||!key||/redact|hidden|encrypted/i.test(key)){console.log('::notice::Email credential is not readable through the management API; no provider test message sent.');}
else if(!/^re_[A-Za-z0-9_\-]{15,}$/.test(key)){console.log('::error::Readable email credential does not have the expected Resend API-key format. No credential value logged and no email sent.');process.exitCode=1;}
else if(typeof sender!=='string'||!/<[^<>\s@]+@auxedu\.com>$/.test(sender)){console.log('::error::Email sender is not in the verified auxedu.com format; no email sent.');process.exitCode=1;}
else{
 const mail=await fetch('https://api.resend.com/emails',{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'auxesis-provider-qa-'+process.env.GITHUB_RUN_ID},body:JSON.stringify({from:sender,to:['adsouza35@gmail.com'],reply_to:'adsouza35@gmail.com',subject:'Auxesis Education — QA provider delivery check',text:'QA ONLY — authorized provider delivery test '+process.env.GITHUB_RUN_ID+'. This tests email-provider configuration only, not the browser inquiry form. No student or family data is involved.'})});
 const body=await mail.json().catch(()=>({}));
 const allowed=['validation_error','restricted_api_key','invalid_api_key','missing_api_key','rate_limit_exceeded','application_error'];
 const text=String(body.message||'');
 console.log('::notice::'+JSON.stringify({providerHttp:mail.status,accepted:mail.ok&&!!body.id,errorName:allowed.includes(body.name)?body.name:mail.ok?null:'other',domainNotVerified:/domain.*not.*verified/i.test(text),testingRecipientRestriction:/testing|test.*email|own email/i.test(text),apiKeyProblem:/API key|unauthoriz/i.test(text)}));
 if(!mail.ok)process.exitCode=1;
}
