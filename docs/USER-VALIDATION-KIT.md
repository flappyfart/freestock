# Eight-person validation: lending earnings into stocks

Prepared 9 September 2026 (UTC). This is a research plan and facilitator kit. No participants have been contacted, recruited or tested. All results below are blank.

## Decision this study should support

Determine whether existing stablecoin lenders prefer using their earnings to accumulate chosen Stock Tokens over receiving USDG or reinvesting—and whether that preference survives realistic costs, waiting and imperfect execution.

The first test uses a clearly labeled, read-only prototype. It does not ask participants to fund a wallet, approve tokens, sign messages or run a trade. Existing-position import and background automation are proposed features, not current Freestock capabilities.

## Exact customer and sample

Recruit **eight people who currently have a stablecoin lending position and personally control its allocation**. All should have used a wallet in the last 30 days and be able to describe their most recent deposit, withdrawal or earnings decision. At least four should have actually moved or reinvested earnings in the last 90 days. Do not recruit only friends who already like Freestock.

Use a spread of actual position sizes to expose cost sensitivity: aim for two below $1,000, four between $1,000 and $10,000, and two above $10,000. These are sampling targets, not product minimums. Record both Robinhood Chain familiarity and whether the participant already owns any stock exposure. Do not assume that a participant's country or interest establishes permission to trade Stock Tokens; this study is about a proposed workflow, not transaction eligibility.

Use participant IDs P01–P08. Names, contact details and wallet addresses are not needed in the research results. A participant may enter figures manually or show a redacted account view. Do not collect wallet secrets, brokerage credentials or full portfolio exports.

## Materials to prepare

The current Freestock modal demonstrates stock purchases, reinvestment and a split of both with simulated funds. It does not yet contain the neutral cash comparison or proposed maximum-cost/revocation controls below. Prepare those as a separate, equally presented worksheet before recruiting. Do not represent the research-only controls as working financial automation.

1. A prototype with three equally prominent outcomes: **receive USDG**, **reinvest in lending**, and **buy selected Stock Tokens**. Rotate their display order across sessions. Keep visual treatment and default emphasis equal.
2. A stock picker offering the currently supported five tokens and weighted baskets. Allow “none of these.”
3. A quote worksheet using the participant's real position size and a current, source-linked cost snapshot. Include the time, chain, protocol and quote validity. If a component cannot be quoted, show it as unknown and mark the comparison incomplete.
4. A saved-rule preview covering destination, a maximum cost, a minimum available-earnings amount, review frequency and a stop control. Label automatic execution as proposed.
5. The session record below, plus a follow-up seven days later. An estimated 35-minute initial session and 10-minute follow-up are sufficient.

## Required inputs and cost discipline

| Input            | What to record                                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current position | Chain, protocol, lending asset, deposited amount, current redeemable value, and date of observation. Use actual figures, not an attractive preset.                                          |
| Earnings basis   | What the protocol actually reports; distinguish received interest from a value increase or Freestock-style surplus above a principal baseline. Note donations, losses or missing history.   |
| Available amount | Earnings that could be withdrawn now, separately from total displayed earnings and withdrawal restrictions. Do not treat an unavailable amount as spendable.                                |
| Rate             | Current observed rate and its period/source. A historical APY is context, not a prediction.                                                                                                 |
| One-time costs   | Account creation, migration, approval or bridging if the proposed route requires them. Present separately from recurring costs; do not silently omit them for an existing-position concept. |
| Recurring costs  | Estimated withdrawal and conversion gas, keeper charge if proposed, and any protocol/platform fee. Convert gas to USDG using a timestamped price.                                           |
| Quote            | Expected stock-token receipts, included swap fees, minimum output, price impact and route availability. Do not count fees twice when already reflected in the quote.                        |
| Comparison       | What the same available amount leaves in USDG, adds to lending, or buys in Stock Tokens after each option's own incremental costs. Do not invent future stock returns.                      |

For the stock option, show a compact breakdown: **available earnings → amount consumed by fees → expected tokens received**. State where gas would actually be paid; wallet-paid ETH is a real user cost even if not deducted from USDG. Taxes and future price changes are outside this preview. If fees exceed the participant's limit, show **“Wait for more earnings”** and preserve the rule rather than presenting an executable conversion.

## Initial session: neutral script and tasks

**Opening:** “We are testing an idea, not your financial knowledge. The product is unfinished. Please use your own situation, and tell us when keeping your current setup is better.”

### 1. Understand the last real decision — 7 minutes

Ask: “What did you last do with the earnings from this position?” Follow the actual event: amount, date, steps, time, fees, reason and outcome. Ask what they left untouched and why. Record behavior before introducing Freestock; do not substitute stated interest for past behavior.

### 2. Compare the three outcomes — 8 minutes

Enter the real available amount and current cost inputs. Ask the participant to choose receive USDG, reinvest, buy stocks, or do nothing. Ask them to explain the choice in their own words. Record the first choice before offering help.

If they choose stocks, ask them to select one ticker or allocate a basket. Then ask: “What would make you change this choice?” If they prefer USDG or reinvesting, explore why with equal attention.

### 3. Set a usable rule — 8 minutes

Ask the participant to set the largest total cost they would accept in both USDG and percent of the available amount. Let them choose a minimum accumulated amount and daily, weekly, monthly or manual review. Explain that a scheduled check does not guarantee a trade.

Ask them to find how to pause or revoke the rule. Record whether they can do this without help and what they believe stopping changes. The intended control stops future conversions; it does not reverse completed purchases.

### 4. Test an adverse case — 7 minutes

Show three brief variations using the same position:

- The available earnings are below their own cost threshold: should the system wait, ask or execute anyway?
- The lending position falls below its recorded principal baseline: show no available surplus and ask what they expect to happen.
- A conversion was submitted but confirmation is unknown: show a pending receipt and ask what action they expect. Do not offer a duplicate trade as a retry.

Measure whether the user understands the consequences before explaining them. These cases test trust and comprehension, not appetite for hypothetical high returns.

### 5. Close with a concrete next step — 5 minutes

Ask whether they want to save the proposed allocation and cost rules for the follow-up, revise them or discard them. Ask: “What would stop you from using this instead of what you do now?” Do not ask whether the product is “cool” or whether they would recommend an unfinished financial feature.

## Seven-day follow-up

Use fresh read-only cost inputs and the participant's updated position figures when available. Show their saved choice without preselecting it as the recommended outcome. Ask them to choose again among USDG, reinvest, stocks and do nothing; then ask what they actually did with earnings during the week.

Record whether they retain, revise or delete the rule and why. Explicitly test whether a larger batch or longer interval changes an earlier rejection. No hypothetical “future APY” or stock-price gain should be introduced to rescue the concept.

## Per-participant record

| Field                                                    | Entry                                 |
| -------------------------------------------------------- | ------------------------------------- |
| ID / interview date                                      |                                       |
| Position size / chain / protocol                         |                                       |
| Last actual earnings action and date                     |                                       |
| Stock ownership / Robinhood Chain familiarity            |                                       |
| Available earnings and confidence in that figure         |                                       |
| Cost snapshot time / missing components                  |                                       |
| First choice before assistance                           | USDG / reinvest / stocks / do nothing |
| Choice after complete cost display                       | USDG / reinvest / stocks / do nothing |
| Stock or basket allocation, if chosen                    |                                       |
| Maximum cost: USDG and percent                           |                                       |
| Minimum conversion amount / review interval              |                                       |
| Unaided understanding: source of money                   | Correct / partial / incorrect         |
| Unaided understanding: costs and waiting                 | Correct / partial / incorrect         |
| Unaided understanding: losses do not guarantee principal | Correct / partial / incorrect         |
| Unaided stop/revoke task                                 | Completed / needed help / failed      |
| Saved, revised or discarded rule                         |                                       |
| Seven-day choice and actual intervening behavior         |                                       |
| Strongest objection, in the participant's words          |                                       |

## Eight-person scorecard

Score **revealed task behavior**, not enthusiasm. Keep the underlying categories and quotes alongside any score.

- **Preference after costs (0–2):** 0 = USDG/reinvest/do nothing; 1 = stocks only under a different cost/batch assumption; 2 = stocks under the shown, usable cost conditions.
- **Comprehension (0–3):** one point each for explaining the earnings source, net cost/waiting rule, and absence of a principal-value guarantee without help.
- **Control (0–1):** one point for finding and accurately explaining pause/revoke without help.
- **Repeat preference (0–2):** 0 = switches away/discards; 1 = materially revises before choosing stocks; 2 = retains the stock choice at follow-up with fresh inputs.

| ID  | Preference /2 | Comprehension /3 | Control /1 | Repeat /2 | Chosen alternative | Cost/batch objection |
| --- | ------------- | ---------------- | ---------- | --------- | ------------------ | -------------------- |
| P01 |               |                  |            |           |                    |                      |
| P02 |               |                  |            |           |                    |                      |
| P03 |               |                  |            |           |                    |                      |
| P04 |               |                  |            |           |                    |                      |
| P05 |               |                  |            |           |                    |                      |
| P06 |               |                  |            |           |                    |                      |
| P07 |               |                  |            |           |                    |                      |
| P08 |               |                  |            |           |                    |                      |

Do not use a high total to hide a comprehension failure. Report initial preference, post-cost preference and follow-up preference separately. Distinguish observed choices from a request to try a future funded pilot; neither proves willingness to pay or long-term retention.

## Decision rule before running the study

These are directional research thresholds, not statistically representative estimates:

- **Proceed to a small manual pilot:** at least five of eight choose stocks after a complete cost display; at least four still choose stocks at follow-up; and at least six correctly explain the earnings source and cost/waiting behavior. Address any principal-value or revoke misunderstanding before funded testing.
- **Adjust the segment or batching:** interest is strong but realistic costs repeatedly reverse choices. Identify the smallest position/available-earnings combination that survives costs; test monthly or threshold-based batches with that segment.
- **Reconsider the core proposition:** fewer than three choose stocks after costs, or most repeatedly prefer USDG/reinvestment. Do not answer this result by adding more animation or a token.
- **Inconclusive:** important costs or available-earnings inputs were unknown, or follow-up participation was too low. Fix the evidence before drawing a product conclusion.

## Research readout template

“We spoke with __ of eight intended customers; __ completed follow-up. __ initially chose stocks, __ chose stocks after costs, and __ retained that choice a week later. The strongest existing alternative was __. The main threshold was __ USDG of available earnings / __ maximum execution cost. We observed __ comprehension or control failures. We will proceed / change batching or segment / reconsider / gather missing evidence because __.”

Attach the timestamped cost assumptions, anonymized session records and disconfirming quotes. Refresh current competitor claims before any public comparison; see `COMPETITOR-EVIDENCE.md` for the dated starting point.
