// Ignore only Cloudflare's reversible email obfuscation when comparing public HTML.
// Every other byte remains significant; no production security setting is changed.
const decode=hex=>{
 if(hex.length<4||hex.length%2||!/^[a-f0-9]+$/i.test(hex))throw Error('Invalid Cloudflare email encoding');
 const key=parseInt(hex.slice(0,2),16);
 return Array.from({length:hex.length/2-1},(_,i)=>String.fromCharCode(parseInt(hex.slice(i*2+2,i*2+4),16)^key)).join('');
};
export function normalizePublicEmail(html){return html
 .replace(/<a href="\/cdn-cgi\/l\/email-protection#([a-f0-9]+)">/gi,(_,hex)=>'<a href="mailto:'+decode(hex)+'">')
 .replace(/<span class="__cf_email__" data-cfemail="([a-f0-9]+)">\[email&#160;protected\]<\/span>/gi,(_,hex)=>decode(hex))
 .replace(/<script data-cfasync="false" src="\/cdn-cgi\/scripts\/[a-f0-9]+\/cloudflare-static\/email-decode\.min\.js"><\/script>/gi,'');}
