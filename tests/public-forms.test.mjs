import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const script=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
async function screen(kind,{siteKey='',ready=true,networkFailure=false,portal=false,submissionError=''}={}){
  const button={disabled:false,textContent:'Submit'};
  const note={hidden:true,firstChild:{textContent:'Online submissions are being set up. Please '}};
  const status={textContent:''},handlers={},requests=[];
  let resets=0;
  const controls=[];controls.consent={checked:true};
  const form={id:kind+'-form',elements:controls,dataset:{},querySelector:selector=>selector==='.delivery-note'?note:button,querySelectorAll:()=>[],reset:()=>resets++,addEventListener:(name,handler)=>handlers[name]=handler,insertBefore:()=>{},checkValidity:()=>{throw new Error('An unavailable form must not validate or submit.');}};
  const context={
    document:{querySelector:()=>null,addEventListener:()=>{},getElementById:id=>id===kind+'-form'?form:id===kind+'-status'?status:null,createElement:()=>({})},
    window:{AUXESIS:{turnstileSiteKey:siteKey,formDelivery:portal?'portal':''},turnstile:{render:()=>1,reset:()=>{}}},
    fetch:async(url,options)=>{requests.push({url,options});if(networkFailure)throw new Error('Offline');return options?.method==='POST'?Response.json(submissionError?{error:submissionError}:{ok:true},{status:submissionError?502:200}):Response.json({ready,token:'one-use-check',notBefore:0});},
    Response,URLSearchParams,queueMicrotask,setTimeout,Date,
    FormData:class{*[Symbol.iterator](){yield ['name','QA enquiry'];}}
  };
  vm.runInNewContext(script,context);
  await new Promise(setImmediate);
  return {button,note,status,form,handlers,requests,get resets(){return resets;}};
}

test('both public forms reveal a contact alternative before input when delivery is unavailable',async()=>{
  for(const kind of ['enquiry','review'])for(const configuration of [{},{siteKey:'test',ready:false}]){
    const s=await screen(kind,configuration);
    assert.equal(s.note.hidden,false);assert.equal(s.button.disabled,true);assert.equal(s.form.dataset.deliveryUnavailable,'true');
    assert.match(s.button.textContent,/coming soon/);
    const before=s.requests.length;let prevented=false;
    await s.handlers.submit({preventDefault:()=>prevented=true});
    assert.equal(prevented,true);assert.equal(s.requests.length,before);
  }
});
test('an availability-check failure leaves an actionable notice instead of an enabled broken form',async()=>{
  for(const kind of ['enquiry','review']){
    const s=await screen(kind,{siteKey:'test',networkFailure:true});
    assert.equal(s.note.hidden,false);assert.equal(s.button.disabled,true);
    assert.match(s.note.firstChild.textContent,/temporarily unavailable/);
    assert.equal(s.button.textContent,'Form temporarily unavailable');
  }
});
test('configured public forms remain available',async()=>{
  for(const kind of ['enquiry','review']){
    const s=await screen(kind,{siteKey:'test',ready:true});
    assert.equal(s.note.hidden,true);assert.equal(s.button.disabled,false);assert.equal(s.form.dataset.deliveryUnavailable,undefined);
  }
});
test('portal delivery enables both forms only after readiness and attaches a one-use check',async()=>{
  for(const kind of ['enquiry','review']){
    const s=await screen(kind,{portal:true});
    assert.equal(s.button.disabled,false);assert.equal(s.note.hidden,true);
    assert.equal(s.requests[0].url,'/api/enquiry?delivery=portal&kind='+kind);
    await s.handlers.submit({preventDefault:()=>{}});
    const posts=s.requests.filter(x=>x.options?.method==='POST');assert.equal(posts.length,1);
    assert.equal(posts[0].url,'/api/'+kind+'?delivery=portal');
    assert.equal(JSON.parse(posts[0].options.body).form_token,'one-use-check');
    assert.equal(s.resets,1);assert.match(s.status.textContent,/has been received/);
  }
});
test('portal delivery failures preserve entered values and never show success',async()=>{
  for(const kind of ['enquiry','review']){
    const s=await screen(kind,{portal:true,submissionError:'Delivery failed. Please email Amanda directly.'});
    await s.handlers.submit({preventDefault:()=>{}});
    assert.equal(s.resets,0);assert.equal(s.status.textContent,'Delivery failed. Please email Amanda directly.');
    assert.equal(s.button.disabled,false);assert.equal(s.form.dataset.sending,undefined);
    const unavailable=await screen(kind,{portal:true,ready:false});assert.equal(unavailable.button.disabled,true);assert.equal(unavailable.note.hidden,false);
  }
});
