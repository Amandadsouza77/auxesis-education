const enc=new TextEncoder(),dec=new TextDecoder();
const bytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function key(secret){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',enc.encode(secret)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
export async function seal(secret,value){const iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(secret),enc.encode(value));return b64(iv)+'.'+b64(data);}
export async function open(secret,value){const [a,b]=value.split('.');const data=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(a)},await key(secret),bytes(b));return dec.decode(data);}
