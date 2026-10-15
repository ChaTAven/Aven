'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');

const dataDir = path.join(__dirname, 'data');
const keyFile = path.join(dataDir, '.media-encryption-key');

function readConfiguredKey(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const key = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('AVEN_MEDIA_ENCRYPTION_KEY must be 32 bytes (64 hex characters or base64).');
  return key;
}

function readKeyFile() {
  const key = fs.readFileSync(keyFile);
  if (key.length !== 32) throw new Error(`Invalid media encryption key file: ${keyFile}`);
  return key;
}

function loadKey() {
  const configured = readConfiguredKey(process.env.AVEN_MEDIA_ENCRYPTION_KEY);
  if (configured) return configured;
  fs.mkdirSync(dataDir, { recursive: true });
  try { return readKeyFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const generated = crypto.randomBytes(32);
  try {
    fs.writeFileSync(keyFile, generated, { flag: 'wx', mode: 0o600 });
    return generated;
  } catch (error) {
    if (error.code === 'EEXIST') return readKeyFile();
    throw error;
  }
}

const key = loadKey();

async function encryptFile(sourcePath, encryptedPath) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
  try {
    await pipeline(
      fs.createReadStream(sourcePath),
      cipher,
      fs.createWriteStream(encryptedPath, { flags: 'wx', mode: 0o600 })
    );
    return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
  } catch (error) {
    fs.rmSync(encryptedPath, { force: true });
    throw error;
  }
}

function encryptFileSync(sourcePath, encryptedPath) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
  const source = fs.readFileSync(sourcePath);
  const encrypted = Buffer.concat([cipher.update(source), cipher.final()]);
  fs.writeFileSync(encryptedPath, encrypted, { flag: 'wx', mode: 0o600 });
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}

function decryptBuffer(encrypted, encodedIv, encodedTag, expectedPlainSize = null) {
  const iv = Buffer.from(String(encodedIv || ''), 'base64');
  const tag = Buffer.from(String(encodedTag || ''), 'base64');
  if (iv.length !== 12 || tag.length !== 16 || encrypted.length < 16) throw new Error('Invalid encrypted media metadata.');
  // The GCM tag is stored alongside the IV in SQLite, so the file itself
  // contains ciphertext with the same length as the plaintext.
  if (expectedPlainSize != null && encrypted.length !== expectedPlainSize) throw new Error('Encrypted media size mismatch.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  if (expectedPlainSize != null && plain.length !== expectedPlainSize) throw new Error('Decrypted media size mismatch.');
  return plain;
}

module.exports = { encryptFile, encryptFileSync, decryptBuffer };
