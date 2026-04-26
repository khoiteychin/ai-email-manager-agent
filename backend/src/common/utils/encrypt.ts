import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function getKey(): Buffer {
  const secret = process.env.AES_SECRET_KEY || 'default_32_char_key_change_this!';
  // Pad/truncate to exactly 32 bytes
  return Buffer.from(secret.padEnd(32, '0').slice(0, 32), 'utf8');
}

export function encrypt(text: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const [ivHex, encrypted] = encryptedText.split(':');
  if (!ivHex || !encrypted) throw new Error('Invalid encrypted format');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
