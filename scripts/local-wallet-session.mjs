import assert from 'node:assert/strict';
import { Wallet } from 'ethers';
// Disposable test wallets only. This helper refuses hosted URLs and sends no transactions.
export async function localWalletSession(
  origin,
  wallet = Wallet.createRandom(),
) {
  const target = new URL(origin);
  assert.ok(
    ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname),
    'Local test only',
  );
  assert.equal(
    target.username + target.password + target.search + target.hash,
    '',
  );
  const cookies = new Map();
  const request = async (path, body) => {
    const response = await fetch(new URL(path, target), {
      method: 'POST',
      redirect: 'error',
      headers: {
        origin: target.origin,
        'content-type': 'application/json',
        cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
      },
      body: JSON.stringify(body),
    });
    for (const item of response.headers.getSetCookie()) {
      const [name, value] = item.split(';', 1)[0].split('=');
      if (value) cookies.set(name, value);
      else cookies.delete(name);
    }
    return { response, data: await response.json() };
  };
  const challenge = await request('/api/auth/challenge', {
    address: wallet.address,
  });
  assert.equal(challenge.response.status, 200, JSON.stringify(challenge.data));
  const verified = await request('/api/auth/verify', {
    id: challenge.data.id,
    signature: await wallet.signMessage(challenge.data.message),
  });
  assert.equal(verified.response.status, 200, JSON.stringify(verified.data));
  assert.equal(verified.data.wallet, wallet.address);
  return {
    wallet,
    cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
  };
}
