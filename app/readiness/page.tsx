import Link from "next/link";
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
export const metadata = { title: "Integration readiness | freestock" };
const items = [
  {
    status: "Verified",
    title: "Network and asset identity",
    body: "Robinhood Chain mainnet is chain 4663. The USDG vault asset matches the canonical six-decimal USDG contract. These are read-only observations, not an active integration.",
    url: "https://docs.robinhood.com/chain/contracts/",
  },
  {
    status: "Partial",
    title: "Independent vault access",
    body: "At block 57,944,950, all four vault gates were unset. Three setters are abdicated; the deposit gate remains changeable with a seven-day timelock. A fresh, unprivileged adapter still needs to complete a deposit and redemption on a pinned fork.",
    url: "https://app.morpho.org/robinhood-chain/vault/0xBeEff033F34C046626B8D0A041844C5d1A5409dd/steakhouse-usdg",
  },
  {
    status: "Partial",
    title: "Cross-chain randomness",
    body: "Both CCIP routers reported support for the opposite chain. VRF v2.5 is documented on Arbitrum. Actual application delivery and retry behavior still need testing. This preview uses server-generated simulated randomness.",
    url: "https://docs.chain.link/vrf/v2-5/security",
  },
  {
    status: "Unproven",
    title: "Stock-token purchase and award",
    body: "Canonical stock-token metadata is available. No executable purchase, settlement, or winner transfer has been tested. Stock tokens provide economic exposure and are not ownership of underlying shares. This preview records dollar allocations only.",
    url: "https://docs.robinhood.com/chain/building-with-stock-tokens/",
  },
  {
    status: "Required",
    title: "Security, accounting, and launch review",
    body: "Live contracts, loss accounting, partial withdrawal liquidity, adversarial testing, an independent audit, operational recovery, and jurisdiction-specific legal eligibility remain release gates. The current app cannot accept real deposits or place trades.",
    url: "https://robinhood.com/us/en/support/articles/robinhood-earn/",
  },
];
export default function Readiness() {
  return (
    <main className="readiness-main">
      <Link href="/" className="secondary">
        <ArrowLeft size={15} />
        Back to freestock
      </Link>
      <h1>Built with the boundaries visible.</h1>
      <p className="readiness-intro">
        The product preview is usable today. Real deposits remain disabled while the live financial
        system is built and independently verified.
      </p>
      <div className="readiness-list">
        {items.map((item) => (
          <section key={item.title} className="readiness-item panel">
            <span className="pill">{item.status}</span>
            <div>
              <h2>{item.title}</h2>
              <p>{item.body}</p>
              <a className="text-button" href={item.url} target="_blank" rel="noreferrer">
                Primary source
                <ExternalLink size={12} />
              </a>
            </div>
          </section>
        ))}
      </div>
      <p className="readiness-footnote">
        <ShieldCheck
          size={16}
          style={{ display: "inline", verticalAlign: "middle", marginRight: 7 }}
        />
        Network observations recorded September 8, 2026. They can change. No real transaction was
        submitted.
      </p>
    </main>
  );
}
