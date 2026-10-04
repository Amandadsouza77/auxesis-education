const menuButton=document.querySelector('.menu-toggle');
const menu=document.querySelector('.main-navigation');
menuButton?.addEventListener('click',()=>{const open=menuButton.getAttribute('aria-expanded')!=='true';menuButton.setAttribute('aria-expanded',String(open));menuButton.textContent=open?'Close':'Menu';menu?.classList.toggle('is-open',open)});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu?.classList.contains('is-open')){menu.classList.remove('is-open');menuButton?.setAttribute('aria-expanded','false');if(menuButton)menuButton.textContent='Menu';menuButton?.focus()}});
const enquiry=document.querySelector('#enquiry-form');
if(enquiry){
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
  fetch('/api/enquiry',{headers:{accept:'application/json'}}).then(response=>response.ok?response.json():null).then(config=>{
    if(config&&(!config.ready||!window.AUXESIS?.turnstileSiteKey)){
      enquiry.querySelector('.delivery-note').hidden=false;
      enquiry.dataset.deliveryUnavailable='true';
      const button=enquiry.querySelector('button[type="submit"]');button.disabled=true;button.textContent='Online enquiries coming soon';
    }
  }).catch(()=>{});
}
const forms=[['enquiry-form','enquiry-status','enquiry','Thank you. Your enquiry has been received. Amanda will be in touch to discuss the student’s needs and tutoring arrangements, usually within 24–48 hours.'],['review-form','review-status','review','Thank you. Your review has been received and will be checked before anything is published.']];
let turnstileLoad;
function loadTurnstile(){
  if(!turnstileLoad)turnstileLoad=new Promise((resolve,reject)=>{if(window.turnstile)return resolve(window.turnstile);const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.onload=()=>resolve(window.turnstile);script.onerror=reject;document.head.append(script)});
  return turnstileLoad;
}
for(const [id,statusId,kind,success] of forms){
  const form=document.getElementById(id);if(!form)continue;
  const status=document.getElementById(statusId);let widget,token='';
  if(window.AUXESIS?.turnstileSiteKey){
    const container=document.createElement('div');container.className='spam-check';form.insertBefore(container,form.querySelector('button[type="submit"]'));
    loadTurnstile().then(api=>{widget=api.render(container,{sitekey:window.AUXESIS.turnstileSiteKey,action:kind,callback:value=>token=value,'expired-callback':()=>token='','error-callback':()=>{token='';status.textContent='Spam protection could not load. Please refresh and try again.'}})}).catch(()=>status.textContent='Spam protection could not load. Please refresh and try again.');
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(form.dataset.sending||form.dataset.deliveryUnavailable)return;
    if(!form.checkValidity()){status.textContent=kind==='enquiry'&&form.elements.email.value&&!form.elements.email.validity.valid?'Please enter a valid email address.':'Please complete the required fields before submitting.';form.reportValidity();return;}
    const data=Object.fromEntries(new FormData(form));data.consent=!!form.elements.consent.checked;data.turnstile_token=token;
    const submit=form.querySelector('button[type="submit"]');form.dataset.sending='true';submit.disabled=true;status.textContent='Sending…';
    try{const response=await fetch('/api/'+kind,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});let result;try{result=await response.json()}catch{throw new Error('Your submission could not be sent. Please try again.')}if(!response.ok||!result.ok)throw new Error(result.error||'Your submission could not be sent. Please try again.');status.textContent=success;form.reset();}
    catch(error){status.textContent=error.message||'Your submission could not be sent. Please try again.';}
    finally{delete form.dataset.sending;submit.disabled=false;token='';if(widget!==undefined)window.turnstile.reset(widget);}
  });
}
