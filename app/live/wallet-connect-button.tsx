"use client";
import "./wallet-connect-button.css";

export function WalletConnectButton({
  walletName,
  reconnect = false,
  disabled,
  onClick,
}: {
  walletName: string;
  reconnect?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const label = reconnect ? "Reconnect wallet" : "Connect wallet";
  return (
    <div className="wallet-connect-option">
      <button
        type="button"
        className="wallet-connect-button"
        disabled={disabled}
        onClick={onClick}
        aria-label={`${label}: ${walletName}`}
      >
        <span className="wallet-connect-text" aria-hidden="true">
          <span>{label}</span>
          <span className="wallet-connect-hover">{label}</span>
        </span>
        <span className="wallet-connect-provider" aria-hidden="true">
          {walletName}
        </span>
      </button>
    </div>
  );
}
