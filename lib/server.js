export function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
export function origin(env){const url=new URL(env.SITE_URL);if(url.protocol!=='https:'||url.origin!==env.SITE_URL.replace(/\/$/,''))throw new Error('Invalid SITE_URL');return url.origin;}
export function text(data,key,max=200){const value=data[key];return typeof value==='string'&&value.length<=max?value.trim():'';}
export function deliveryReady(env){
  try{origin(env);}catch{return false;}
  return !!(env.RESEND_API_KEY&&env.EMAIL_FROM&&env.ENQUIRY_TO&&env.TURNSTILE_SECRET_KEY);
}
export async function submit(request,env,kind){
  let site;try{site=origin(env);}catch{return json({error:'Website email is not configured yet.'},503);}
  if(request.headers.get('origin')!==site)return json({error:'This request is not allowed.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Use JSON.'},415);
  if(Number(request.headers.get('content-length')||0)>24000)return json({error:'Submission is too long.'},413);
  let data;try{const raw=await request.text();if(raw.length>24000)return json({error:'Submission is too long.'},413);data=JSON.parse(raw);}catch{return json({error:'Invalid submission.'},400);}
  if(!data||typeof data!=='object'||Array.isArray(data))return json({error:'Invalid submission.'},400);
  if(data.website)return json({ok:true});
  if(data.consent!==true)return json({error:'Please confirm your consent.'},400);
  let fields,replyTo;
  if(kind==='enquiry'){
    const required=['name','email','country','timezone','year','programme','subject','support','contact'];
    if(required.some(k=>!text(data,k,k==='support'?8000:200)))return json({error:'Please complete the required fields.'},400);
    replyTo=text(data,'email');if(!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(replyTo))return json({error:'Please enter a valid email address.'},400);
    if(!['Email','Phone'].includes(data.contact))return json({error:'Please choose a contact method.'},400);
    const timezone=text(data,'timezone');
    const utc=/^UTC([+−-])(\d{2}):(00|15|30|45)$/.exec(timezone);
    const gmt=/^GMT ([+-])([0-9]{1,2}(?:\.(?:25|5|75))?)$/.exec(timezone);
    const hours=timezone==='UTC±00:00'?0:utc?(utc[1]==='+'?1:-1)*(Number(utc[2])+Number(utc[3])/60):gmt?Number(gmt[1]+gmt[2]):NaN;
    if(!Number.isFinite(hours)||hours< -12||hours>14)return json({error:'Please choose a valid UTC offset.'},400);
    for(const key of ['year','programme','subject']){
      if(data[key]==='Other'&&!text(data,'other_'+key))return json({error:'Please specify the other '+(key==='year'?'year or level':key)+'.'},400);
    }
    const phone=text(data,'phone',Infinity),callingCode=text(data,'phone_country_code',4);
    if(data.contact==='Phone'&&(phone||callingCode)&&(!phone||!/^\+[1-9][0-9]{0,2}$/.test(callingCode)))return json({error:'Please enter both the country calling code and phone number, or leave both blank.'},400);
    fields=required.concat(['other_year','other_programme','other_subject']).map(k=>[k,text(data,k,k==='support'?8000:200)]);
    if(data.contact==='Phone')fields.push(['phone',phone?callingCode+' '+phone:'']);
  }else{
    if(!text(data,'review',8000)||!text(data,'relationship'))return json({error:'Please complete the required fields.'},400);
    fields=['review','relationship','public_name'].map(k=>[k,text(data,k,k==='review'?8000:200)]);
  }
  if(!env.RESEND_API_KEY||!env.EMAIL_FROM||!env.ENQUIRY_TO||!env.TURNSTILE_SECRET_KEY)return json({error:'Website email is not configured yet. Please use the contact link on this website.'},503);
  const token=text(data,'turnstile_token',2048);if(!token)return json({error:'Please complete the spam-protection check.'},400);
  try{
    const verify=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:token,remoteip:request.headers.get('cf-connecting-ip')||''})});const result=await verify.json();
    if(!result.success||result.hostname!==new URL(site).hostname||result.action!==kind)return json({error:'Spam-protection check failed. Please try again.'},400);
    const message={from:env.EMAIL_FROM,to:[env.ENQUIRY_TO],subject:kind==='enquiry'?'Auxesis Education — tutoring enquiry':'Auxesis Education — review awaiting approval',text:fields.map(([k,v])=>k+':\n'+v).join('\n\n')+'\n\nConsent confirmed.\n'+(kind==='review'?'Moderation required. Nothing has been published.':'Submitted through the website.')};if(replyTo)message.reply_to=replyTo;
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:'Bearer '+env.RESEND_API_KEY,'content-type':'application/json'},body:JSON.stringify(message)});
    return response.ok?json({ok:true}):json({error:'Your submission could not be delivered. Please try again.'},502);
  }catch{return json({error:'Your submission could not be delivered. Please try again.'},502);}
}
