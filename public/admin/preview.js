/* Decap previews use the same templates and copy as the generated site. */
fetch('/admin/preview-data.json').then(response=>response.json()).then(base=>{
  const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;'}[c]));
  function copy(template,data){const values=Object.fromEntries((data.blocks||[]).map(b=>[b.key,b.text]));return template.replace(/%%COPY:([^%]+)%%/g,(_,key)=>{const d=base.defaults[key];return values[key]===d.text?d.raw:e(values[key]??d.text).replace(/\n/g,'<br>')})}
  function cards(items,short){return '<div class="recommendation-grid'+(short?' home-recommendations':'')+'">'+items.map(i=>'<figure class="recommendation-card"><p class="eyebrow">'+e(i.topic)+'</p><blockquote><p>“'+e(short?(i.short_quote||i.quote):i.quote)+'”</p></blockquote><figcaption><strong>'+e(i.name)+'</strong><span>'+e(i.relationship)+'</span><span class="recommendation-source">LinkedIn recommendation · <time datetime="'+e(i.date)+'">'+e(i.display_date)+'</time></span></figcaption></figure>').join('')+'</div>'}
  function preview(name,props){
    const data=props.entry.get('data').toJS(),current=structuredClone(base);let page='home';
    if(name.startsWith('page-')){page=name.slice(5);current.pages[page]=data;}
    else if(['header','footer','cta'].includes(name))current.shared_content[name]=data;
    else if(name==='recommendations'){current.recommendations=data;page='recommendations';}
    else if(name==='settings')current.settings=data;
    const info=current.pages[page],shared=Object.fromEntries(['header','footer','cta'].map(n=>[n,copy(current.shared_templates[n],current.shared_content[n])]));
    let doc=shared.header+'<main id="main">'+copy(current.templates[page],info)+'</main>'+shared.footer;
    doc=doc.replace('%%TITLE%%',e(info.title)).replace('%%DESCRIPTION%%',e(info.description)).replaceAll('%%COMPONENT:cta%%',shared.cta).replaceAll('%%VERIFY_URL%%',e(current.recommendations.verification_url));
    for(const group of ['parents','students','colleagues','home']){const items=current.recommendations.recommendations.filter(i=>group==='home'?['macel','lynne','vy'].includes(i.id):i.group===group);doc=doc.replaceAll('%%CARDS:'+group+'%%',cards(items,group==='home'));}
    if(current.settings.public_email)doc=doc.replaceAll('[PLACEHOLDER: Public Auxesis Education business email address.]','<a href="mailto:'+e(current.settings.public_email)+'">'+e(current.settings.public_email)+'</a>');
    if(current.settings.logo&&current.settings.logo!='/assets/logo.png')doc=doc.replaceAll('src="/assets/logo.png"','src="'+e(props.getAsset(current.settings.logo).toString())+'"');
    if(current.settings.portrait)doc=doc.replace(/<figure class="portrait-placeholder".*?<\/figure>/gs,'<figure class="portrait-placeholder"><img class="amanda-photo" src="'+e(props.getAsset(current.settings.portrait).toString())+'" alt="'+e(current.settings.portrait_alt)+'"></figure>');
    if(current.settings.production)doc=doc.replace('<div class="prototype-banner">Private website prototype · No analytics or advertising trackers</div>','');
    doc=doc.replace(/<script\b[^>]*>.*?<\/script>/gs,'').replace('<head>','<head><base href="'+e(location.origin)+'/">');
    return window.h('iframe',{title:'Website preview',srcDoc:doc,sandbox:'allow-same-origin',style:{width:'100%',height:'85vh',border:0,background:'#F8F6F0'}});
  }
  for(const name of [...base.routes.filter(r=>r.name!=='404').map(r=>'page-'+r.name),'header','footer','cta','settings','recommendations'])window.CMS.registerPreviewTemplate(name,props=>preview(name,props));
}).catch(error=>console.error('Editor previews could not load.',error));
