import fs from 'node:fs';
import solc from 'solc';
import { keccak256, toUtf8Bytes } from 'ethers';
const source = fs.readFileSync(
  'contracts/src/FreestockYieldAccount.sol',
  'utf8',
);
const input = {
  language: 'Solidity',
  sources: { 'FreestockYieldAccount.sol': { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    viaIR: true,
    evmVersion: 'cancun',
    outputSelection: {
      '*': { '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode'] },
    },
  },
};
const output = JSON.parse(solc.compile(JSON.stringify(input)));
for (const error of output.errors ?? []) console.error(error.formattedMessage);
if ((output.errors ?? []).some((e) => e.severity === 'error')) process.exit(1);
const contract =
  output.contracts['FreestockYieldAccount.sol'].FreestockYieldAccount;
const artifact = {
  compiler: solc.version(),
  sourceHash: keccak256(toUtf8Bytes(source)),
  settings: input.settings,
  abi: contract.abi,
  bytecode: '0x' + contract.evm.bytecode.object,
  deployedBytecode: '0x' + contract.evm.deployedBytecode.object,
  immutableReferences: contract.evm.deployedBytecode.immutableReferences,
};
fs.writeFileSync(
  'contracts/artifacts/FreestockYieldAccount.artifact.json',
  JSON.stringify(artifact, null, 2),
);
fs.writeFileSync(
  'contracts/artifacts/account-standard-input.json',
  JSON.stringify(input, null, 2),
);
console.log('Compiled account v2 with', solc.version(), artifact.sourceHash);
