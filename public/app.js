const menuButton=document.querySelector('.menu-toggle');
const menu=document.querySelector('.main-navigation');
menuButton?.addEventListener('click',()=>{const open=menuButton.getAttribute('aria-expanded')!=='true';menuButton.setAttribute('aria-expanded',String(open));menuButton.textContent=open?'Close':'Menu';menu?.classList.toggle('is-open',open)});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu?.classList.contains('is-open')){menu.classList.remove('is-open');menuButton?.setAttribute('aria-expanded','false');if(menuButton)menuButton.textContent='Menu';menuButton?.focus()}});
const enquiry=document.querySelector('#enquiry-form');
if(enquiry){
  const timezone=enquiry.elements.namedItem('timezone');
  if(timezone?.dataset.examples){
    try{
      const examples=new Map();
      const now=new Date();
      for(const [place,zone] of JSON.parse(timezone.dataset.examples)){
        const offset=new Intl.DateTimeFormat('en-GB',{timeZone:zone,timeZoneName:'longOffset'}).formatToParts(now).find(part=>part.type==='timeZoneName').value;
        const value=/^GMT(?:[+−-]00:00)?$/.test(offset)?'UTC±00:00':offset.replace('GMT','UTC').replace('-','−');
        if(!examples.has(value))examples.set(value,[]);
        examples.get(value).push(place);
      }
      for(const option of timezone.options)if(option.value){
        const places=examples.get(option.value);
        option.textContent=option.value+(places?' — '+places.join(' / '):'');
      }
    }catch{ /* UTC offsets remain usable when regional formatting is unavailable. */ }
  }
  const update=()=>{
    enquiry.querySelectorAll('[data-other-for]').forEach(field=>{
      const show=enquiry.elements.namedItem(field.dataset.otherFor).value==='Other';
      field.hidden=!show;
      const input=field.querySelector('input');input.disabled=!show;input.required=show;
    });
    const phone=enquiry.querySelector('input[name="contact"]:checked')?.value==='Phone';
    enquiry.querySelectorAll('.phone-field').forEach(field=>{field.hidden=!phone;field.querySelector('input,select').disabled=!phone});
    const codeRequired=phone&&!!enquiry.elements.phone.value.trim();
    const numberRequired=phone&&!!enquiry.elements.phone_country_code.value.trim();
    enquiry.elements.phone_country_code.required=codeRequired;
    enquiry.elements.phone.required=numberRequired;
    enquiry.querySelector('[data-required-for="phone_country_code"]').hidden=!codeRequired;
    enquiry.querySelector('[data-required-for="phone"]').hidden=!numberRequired;
    enquiry.querySelector('[data-optional-for="phone"]').hidden=numberRequired;
  };
  for(const name of ['year','programme','subject'])enquiry.elements.namedItem(name).addEventListener('change',update);
  enquiry.querySelectorAll('input[name="contact"]').forEach(input=>input.addEventListener('change',update));
  enquiry.elements.phone.addEventListener('input',update);
  enquiry.elements.phone_country_code.addEventListener('input',update);
  enquiry.elements.phone_country_code.addEventListener('change',update);
  enquiry.addEventListener('reset',()=>queueMicrotask(update));
  const aliases={'AS & A-Level':'AS / A-Level','Ontario':'Ontario Secondary Science','ESS':'Environmental Systems and Societies'};
  const qs=new URLSearchParams(location.search);
  for(const name of ['programme','subject']){const select=enquiry.elements.namedItem(name);const value=aliases[qs.get(name)]||qs.get(name);if([...select.options].some(o=>o.value===value))select.value=value;}
  update();
}
function formUnavailable(form,kind,temporary=false){
  const note=form.querySelector('.delivery-note');
  if(note){if(temporary)note.firstChild.textContent='This form is temporarily unavailable. Please email Amanda at ';note.hidden=false;}
  form.dataset.deliveryUnavailable='true';
  const button=form.querySelector('button[type="submit"]');button.disabled=true;
  button.textContent=temporary?'Form temporarily unavailable':kind==='enquiry'?'Online enquiries coming soon':'Online reviews coming soon';
}
const forms=[['enquiry-form','enquiry-status','enquiry','Thank you. Your enquiry has been received. Amanda will be in touch to discuss the student’s needs and tutoring arrangements, usually within 24–48 hours.'],['review-form','review-status','review','Thank you. Your review has been received and will be checked before anything is published.']];
let turnstileLoad;
function markFormErrors(form,status,focus=false){
  form.querySelectorAll('.field-error').forEach(error=>error.remove());
  const controls=[...form.elements].filter(control=>control.willValidate);
  for(const control of controls)control.setCustomValidity(control.required&&typeof control.value==='string'&&!control.value.trim()&&!['checkbox','radio'].includes(control.type)?'Please complete this field.':'');
  for(const control of form.elements){
    control.removeAttribute('aria-invalid');
    const descriptions=(control.getAttribute('aria-describedby')||'').split(' ').filter(id=>id&&!id.startsWith(form.id+'-error-'));
    if(descriptions.length)control.setAttribute('aria-describedby',descriptions.join(' '));else control.removeAttribute('aria-describedby');
  }
  const invalid=controls.filter(control=>!control.validity.valid);
  invalid.forEach((control,index)=>{
    const error=document.createElement('span');error.id=form.id+'-error-'+index;error.className='field-error';
    error.textContent=control.validity.typeMismatch?'Enter a valid email address.':control.type==='checkbox'?'Please confirm this before submitting.':control.tagName==='SELECT'?'Please choose an option.':'Please complete this field.';
    control.setAttribute('aria-invalid','true');
    control.setAttribute('aria-describedby',((control.getAttribute('aria-describedby')||'')+' '+error.id).trim());
    const label=control.closest('label');
    if(label?.classList.contains('check'))label.after(error);else (label||control.parentElement).append(error);
  });
  status.textContent=invalid.length?'Please check the highlighted fields.':'';
  if(focus)invalid[0]?.focus();
  return invalid.length===0;
}
function loadTurnstile(){
  if(!turnstileLoad)turnstileLoad=new Promise((resolve,reject)=>{if(window.turnstile)return resolve(window.turnstile);const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.onload=()=>resolve(window.turnstile);script.onerror=reject;document.head.append(script)});
  return turnstileLoad;
}
for(const [id,statusId,kind,success] of forms){
  const form=document.getElementById(id);if(!form)continue;
  const status=document.getElementById(statusId);let widget,token='',formCheck;const portalDelivery=window.AUXESIS?.formDelivery==='portal';
  async function refreshFormCheck(){const r=await fetch('/api/enquiry?delivery=portal&kind='+kind,{headers:{accept:'application/json'}});const config=await r.json();if(!r.ok||!config.ready||!config.token)throw new Error(config.error||'Availability check failed');return {...config,receivedAt:Date.now()};}
  form.noValidate=true;
  for(const event of ['input','change'])form.addEventListener(event,()=>{if(form.dataset.validationAttempted)markFormErrors(form,status)});
  if(portalDelivery){const button=form.querySelector('button[type="submit"]');button.disabled=true;refreshFormCheck().then(config=>{formCheck=config;button.disabled=false;}).catch(()=>formUnavailable(form,kind,true));}
  else if(!window.AUXESIS?.turnstileSiteKey)formUnavailable(form,kind);
  else fetch('/api/enquiry',{headers:{accept:'application/json'}}).then(response=>{
    if(!response.ok)throw new Error('Availability check failed');return response.json();
  }).then(config=>{if(!config?.ready)formUnavailable(form,kind);}).catch(()=>formUnavailable(form,kind,true));
  if(!portalDelivery&&window.AUXESIS?.turnstileSiteKey){
    const container=document.createElement('div');container.className='spam-check';form.insertBefore(container,form.querySelector('button[type="submit"]'));
    loadTurnstile().then(api=>{widget=api.render(container,{sitekey:window.AUXESIS.turnstileSiteKey,action:kind,callback:value=>token=value,'expired-callback':()=>token='','error-callback':()=>{token='';status.textContent='Spam protection could not load. Please refresh and try again.'}})}).catch(()=>status.textContent='Spam protection could not load. Please refresh and try again.');
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(form.dataset.sending||form.dataset.deliveryUnavailable)return;
    form.dataset.validationAttempted='true';
    if(!markFormErrors(form,status,true))return;
    delete form.dataset.validationAttempted;
    const data=Object.fromEntries(new FormData(form));data.consent=!!form.elements.consent.checked;data.turnstile_token=token;
    const submit=form.querySelector('button[type="submit"]');form.dataset.sending='true';submit.disabled=true;status.textContent='Sending…';
    try{if(portalDelivery){if(!formCheck||Date.now()-formCheck.receivedAt>1700000)formCheck=await refreshFormCheck();const wait=Math.max(0,formCheck.notBefore-(Date.now()-formCheck.receivedAt));if(wait)await new Promise(resolve=>setTimeout(resolve,wait));data.form_token=formCheck.token;}const response=await fetch('/api/'+kind+(portalDelivery?'?delivery=portal':''),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});let result;try{result=await response.json()}catch{throw new Error('Your submission could not be sent. Please try again.')}if(!response.ok||!result.ok)throw new Error(result.error||'Your submission could not be sent. Please try again.');status.textContent=success;form.reset();form.querySelectorAll('.field-error').forEach(el=>el.remove());for(const control of form.elements)control.removeAttribute('aria-invalid');}
    catch(error){status.textContent=error.message||'Your submission could not be sent. Please try again.';}
    finally{delete form.dataset.sending;submit.disabled=form.dataset.deliveryUnavailable==='true';token='';if(widget!==undefined)window.turnstile.reset(widget);if(portalDelivery){formCheck=null;refreshFormCheck().then(config=>formCheck=config).catch(()=>{});}}
  });
}
