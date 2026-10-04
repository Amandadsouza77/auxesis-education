import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const script=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
async function screen(kind,{siteKey='',ready=true,networkFailure=false}={}){
  const button={disabled:false,textContent:'Submit'};
  const note={hidden:true,firstChild:{textContent:'Online submissions are being set up. Please '}};
  const status={textContent:''},handlers={},requests=[];
  const form={dataset:{},querySelector:selector=>selector==='.delivery-note'?note:button,addEventListener:(name,handler)=>handlers[name]=handler,insertBefore:()=>{},checkValidity:()=>{throw new Error('An unavailable form must not validate or submit.');}};
  const context={
    document:{querySelector:()=>null,addEventListener:()=>{},getElementById:id=>id===kind+'-form'?form:id===kind+'-status'?status:null,createElement:()=>({})},
    window:{AUXESIS:{turnstileSiteKey:siteKey},turnstile:{render:()=>1,reset:()=>{}}},
    fetch:async(url,options)=>{requests.push({url,options});if(networkFailure)throw new Error('Offline');return Response.json({ready});},
    Response,URLSearchParams,queueMicrotask
  };
  vm.runInNewContext(script,context);
  await new Promise(setImmediate);
  return {button,note,status,form,handlers,requests};
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
