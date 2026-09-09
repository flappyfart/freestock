'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

const TOKEN_CONTRACT = '0xa83e44de3ab8c3aaf2bdf0da40dbfd44885a6a16';

export function TokenContract() {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(TOKEN_CONTRACT);
      setStatus('copied');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="token-contract">
      <span className="token-contract-label">Token contract · CA</span>
      <code>{TOKEN_CONTRACT}</code>
      <button
        type="button"
        onClick={copyAddress}
        aria-label="Copy Freestock token contract address"
      >
        {status === 'copied' ? (
          <Check size={16} aria-hidden="true" />
        ) : (
          <Copy size={16} aria-hidden="true" />
        )}
        {status === 'copied' ? 'Copied' : 'Copy'}
      </button>
      <output
        className={status === 'error' ? 'token-contract-error' : 'sr-only'}
      >
        {status === 'copied'
          ? 'Contract address copied.'
          : status === 'error'
            ? 'Select the address to copy it manually.'
            : ''}
      </output>
    </div>
  );
}
