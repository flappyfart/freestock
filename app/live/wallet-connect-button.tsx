"use client";
import "./wallet-connect-button.css";

export function WalletConnectButton({
  walletName,
  reconnect = false,
  disabled,
  onClick,
  compact = false,
  label: customLabel,
  ariaLabel,
}: {
  walletName: string;
  reconnect?: boolean;
  disabled: boolean;
  onClick: () => void;
  compact?: boolean;
  label?: string;
  ariaLabel?: string;
}) {
  const label = customLabel ?? (reconnect ? "Reconnect wallet" : "Connect wallet");
  return (
    <div className={`wallet-connect-option${compact ? " wallet-connect-option-compact" : ""}`}>
      <button
        type="button"
        className="wallet-connect-button"
        disabled={disabled}
        onClick={onClick}
        aria-label={ariaLabel ?? `${label}: ${walletName}`}
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
