# Freestock V2 and archived V1 local-fork regression

Completed 2026-09-09 18:06:22 UTC: **59 assertions passed**, with **12 local transactions** (10 successful, 2 intentionally reverted).

This was a local-only Anvil exercise at `http://127.0.0.1:18549`, chain ID 4663, Cancun hardfork. No public transactions were submitted. Every signer was freshly generated and fake-funded locally; private keys were never printed or persisted. Contract roles and gates were not overridden, and no account was impersonated.

## Exact evidence

- Successful machine-readable evidence: [v2-v1-fork-regression-result.json](v2-v1-fork-regression-result.json)
- Preliminary unbuffered attempt: [v2-v1-fork-regression-unbuffered-attempt.json](v2-v1-fork-regression-unbuffered-attempt.json)
- Source fork block: **58746420**
- Source fork hash: `0x0ae954b70a9db9fff1c4a6028d110fb59875716bde67e1f98e3369157f9829b7`
- Successful run starts at local block 58746429 and ends at 58746442. It uses fresh signers/accounts but follows the preliminary local attempt on this same fork.

The originally requested source block 58732045 was unavailable from the official RPC's state archive. Its vault and system-contract reads returned `metadata is not found, 58732048`. The replacement source block above was checked directly for matching block number/hash and accessible vault bytecode before restarting the dedicated local node.

## What passed

V2 deployed from the current artifact with `depositCap == MaxUint256`. It accepted a 1,000 USDG deposit, recorded the exact principal, consumed the exact owner approval, reset temporary vault allowances and preserved redeemable value within rounding. An unrelated generated wallet was rejected by both simulation and a mined full-withdrawal attempt.

Archived V1 deployed from its exact saved artifact with a 100 USDG cap. A 101 USDG deposit failed in simulation and in a mined transaction without changing principal or wallet USDG. A constructor request for an uncapped V1 also failed. A 100 USDG deposit succeeded, and an additional one-micro-USDG deposit was rejected.

Both accounts exited fully: account vault shares, idle USDG and principal all returned to zero. The V1 wallet reconciled to 300 USDG. The V2 wallet reconciled to 1,999.900004 USDG after starting with 2,000 fake USDG and spending 0.1 USDG on the stock purchase below.

## Constructed-surplus stock purchase

The runner donated **1 fake USDG** directly to the V2 account to construct spendable surplus. This is not evidence of measured borrower interest, nor a return forecast.

The current local-fork 0.05% USDG/NVDA pool quoted 0.1 USDG into **0.000445446546791484 NVDA tokens**. Minimum output was 0.000440992081323569 tokens. The harvest delivered the quoted amount directly to the owner wallet, recorded exact spending, left principal covered and reset router/vault allowances. A request to spend principal as surplus was rejected separately.

## Gas and artifact boundaries

An initial V1 deposit using an unbuffered gas estimate reverted; its identical call succeeded when replayed without an explicit gas cap. The successful runner uses `eth_estimateGas` plus the same 20% gas-limit buffer as application preparation. The earlier attempt is retained rather than presented as a passing run.

Source hashes matched the saved artifacts, and deployed runtime bytecode matched after accounting for immutable offsets. This runner did not recompile Solidity.

- V2 source hash: `0x0af9043d203a80084418631689c0b89bb40e9fc1af0c6f24071a6991ff17e214`
- V1 source hash: `0xb43bec67f7266c27c1da0fc40b35775496f2ee5c0a8f31218500bd1ea7352656`
- Both artifacts identify compiler `0.8.30+commit.73712a01.Emscripten.clang`.

The account addresses and transaction hashes in the JSON are local fixtures. A mainnet chain ID on a local fork does not make them public deployments or funded production evidence.

## Portable evidence package

This package includes the completed run and the retained preliminary attempt. Local account addresses and transaction hashes identify generated test fixtures only. No private keys, local filesystem paths or device names are included. The dedicated Anvil process was stopped after verification. These recorded results do not establish current pool liquidity, production deployments, or a future return.
