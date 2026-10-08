import {createPrivateKey,createPublicKey,createHash,generateKeyPairSync,diffieHellman,hkdfSync,randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
const info=Buffer.from('AuxesisProductionMigration-v1');
export function releaseKey(secret){
 if(typeof secret!=='string'||secret.length<40)throw new Error('Protected release key is unavailable.');
 const seed=createHash('sha256').update(secret).digest();
 const privateKey=createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b656e04220420','hex'),seed]),format:'der',type:'pkcs8'});
 return {privateKey,publicKey:createPublicKey(privateKey).export({format:'der',type:'spki'}).toString('base64')};
}
export function encryptRelease(publicKey,payload){
 const target=createPublicKey({key:Buffer.from(publicKey,'base64'),format:'der',type:'spki'}),ephemeral=generateKeyPairSync('x25519'),salt=randomBytes(32),nonce=randomBytes(12);
 const key=hkdfSync('sha256',diffieHellman({privateKey:ephemeral.privateKey,publicKey:target}),salt,info,32),cipher=createCipheriv('aes-256-gcm',Buffer.from(key),nonce);
 cipher.setAAD(info);const ciphertext=Buffer.concat([cipher.update(payload),cipher.final()]);
 return {version:1,ephemeral:ephemeral.publicKey.export({format:'der',type:'spki'}).toString('base64'),salt:salt.toString('base64'),nonce:nonce.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')};
}
export function decryptRelease(secret,envelope){
 if(envelope.version!==1)throw new Error('Unsupported encrypted release.');
 const ephemeral=createPublicKey({key:Buffer.from(envelope.ephemeral,'base64'),format:'der',type:'spki'}),key=hkdfSync('sha256',diffieHellman({privateKey:releaseKey(secret).privateKey,publicKey:ephemeral}),Buffer.from(envelope.salt,'base64'),info,32);
 const decipher=createDecipheriv('aes-256-gcm',Buffer.from(key),Buffer.from(envelope.nonce,'base64'));decipher.setAAD(info);decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
 return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext,'base64')),decipher.final()]);
}
