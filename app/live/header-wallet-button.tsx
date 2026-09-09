'use client';
import { WalletConnectButton } from './wallet-connect-button';
import { useWalletConnection } from './wallet-provider';
export function HeaderWalletButton({
  navigationLocked,
  onNavigationBlocked,
  onOpen,
}: {
  navigationLocked: boolean;
  onNavigationBlocked?: () => void;
  onOpen?: () => void;
}) {
  const wallet = useWalletConnection();
  const owner = wallet.owner;
  const label = wallet.busy
    ? 'Checking wallet'
    : owner
      ? 'Wallet connected'
      : 'Connect wallet';
  const detail = owner
    ? `${owner.slice(0, 6)}…${owner.slice(-4)}${wallet.network !== 4663 ? ' · change network' : ''}`
    : (wallet.selected?.info.name ?? 'Choose your wallet');
  return (
    <div className="header-wallet-control">
      <WalletConnectButton
        compact
        label={label}
        walletName={detail}
        ariaLabel={
          owner
            ? `Connected wallet ${owner}. Open wallet selection and dashboard.`
            : 'Connect wallet. Choose an installed browser wallet.'
        }
        disabled={wallet.busy}
        onClick={() => {
          if (navigationLocked) {
            onNavigationBlocked?.();
            return;
          }
          onOpen?.();
          wallet.requestConnect();
        }}
      />
    </div>
  );
}
