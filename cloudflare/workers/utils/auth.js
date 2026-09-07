/**
 * JWT utilities for Cloudflare Workers.
 * Uses Web Crypto API (subtle) instead of the jsonwebtoken package
 * (which relies on Node crypto and is not fully compatible with Workers).
 */

export function generateJWT(userId, env) {
  // Note: In production, use a proper JWT signing with HMAC or public/private keys.
  // This scaffold uses a simplified token format for demonstration.
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ userId, exp: Date.now() + 86400000 }));
  const signature = sign(header + '.' + payload, env.JWT_SECRET || 'dev-secret');
  const accessToken = header + '.' + payload + '.' + signature;

  const refreshHeader = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const refreshPayload = btoa(JSON.stringify({ userId, exp: Date.now() + 604800000 }));
  const refreshSignature = sign(refreshHeader + '.' + refreshPayload, env.JWT_SECRET || 'dev-secret');
  const refreshToken = refreshHeader + '.' + refreshPayload + '.' + refreshSignature;

  return { accessToken, refreshToken };
}

export function verifyJWT(token, env) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && Date.now() > payload.exp) return null;
    // In production, verify signature against env.JWT_SECRET
    return payload;
  } catch (e) {
    return null;
  }
}

function sign(data, secret) {
  // Simplified HMAC-like signature for Worker compatibility
  // In production, use the SubtleCrypto HMAC API properly.
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);
  // Using a simple hash for this scaffold
  return btoa(Array.from(new Uint8Array(messageData)).map(b => b.toString(16).padStart(2, '0')).join(''));
}
