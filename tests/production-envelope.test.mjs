import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseKey,encryptRelease,decryptRelease} from '../scripts/production-envelope.mjs';

test('release transport is authenticated, opaque, and decrypts only with the protected key',()=>{
 const secret='a'.repeat(64),payload=Buffer.from('{"privateRecord":"fixture-only","revision":3}');
 const encrypted=encryptRelease(releaseKey(secret).publicKey,payload);
 assert.equal(JSON.stringify(encrypted).includes('fixture-only'),false);
 assert.deepEqual(decryptRelease(secret,encrypted),payload);
 assert.throws(()=>decryptRelease('b'.repeat(64),encrypted));
 const tampered={...encrypted,ciphertext:Buffer.alloc(Buffer.from(encrypted.ciphertext,'base64').length).toString('base64')};
 assert.throws(()=>decryptRelease(secret,tampered));
 assert.throws(()=>releaseKey('weak'));
});
