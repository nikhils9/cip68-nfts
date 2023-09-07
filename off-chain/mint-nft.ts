import { Constr, Data, fromHex, fromText, toHex, toUnit, UTxO } from "lucid";
import { createLucidInstance, getCredential } from "./utils/lucid/utils.ts";
import { crypto } from "crypto";
import {
  APPLIED_VALIDATOR_PATH,
  NON_FUNGIBLE_TOKEN_LABEL,
  REFERENCE_TOKEN_LABEL,
} from "./common/constants.ts";
import { AppliedValidator } from "./common/types.ts";

const lucid = await createLucidInstance();

lucid.selectWalletFromPrivateKey(await getCredential("issuer.sk"));

const issuerAddr = await getCredential("issuer.addr");
const userAddr = await getCredential("user.addr");
const userUtxos = await lucid.utxosAt(userAddr);

if (!userUtxos || !userUtxos.length) {
  console.error("No UTxO found at user address: " + userAddr);
}
// TODO Idx of utxo < 256
// TODO take only the utxo required for tx costs

// Taking the first utxo for calculating name
const assetNameSuffix = await getUniqueAssetName(userUtxos[0]);

const mintValidator: AppliedValidator = JSON.parse(
  await Deno.readTextFile(APPLIED_VALIDATOR_PATH + "mint.mint.json"),
);

const storeValidator: AppliedValidator = JSON.parse(
  await Deno.readTextFile(
    APPLIED_VALIDATOR_PATH + "reference_store.store.json",
  ),
);

const refNFT = toUnit(
  mintValidator.policyId,
  assetNameSuffix,
  REFERENCE_TOKEN_LABEL,
);

const userNFT = toUnit(
  mintValidator.policyId,
  assetNameSuffix,
  NON_FUNGIBLE_TOKEN_LABEL,
);

const mintRdmr = Data.to(new Constr(0, []));

// TODO create Metadatum type for direct serialization
// Metadata to be store in the datum of UTxO containing Ref NFT
const metadata = new Map<string, string>();
metadata.set(fromText("name"), fromText("The Prince"));
metadata.set(
  fromText("image"),
  fromText("ipfs://QmPUi8j9XgcDrWrr4h5aa8AN4bN813ptTWc1JnmJQfLwa3"),
);
metadata.set(fromText("artist"), fromText("Niccolo Machiavelli"));
metadata.set(fromText("mediaType"), fromText("image/png"));
metadata.set(fromText("description"), fromText("The future ruler"));
console.log(metadata);
const version = 1n;
const extra = Data.void();

const metadatum = Data.to(new Constr(0, [metadata, version, extra]));

/*
The below steps facilitate building the tx server side. Partially sign it
with distributor key and then send it (tx + partialSignedTx) accross to
client for assembling the tx with distributor witness and sign + submit.
*/
// TODO: Instead of selecting all utxos at script and user addresses, select based on tx costs
const tx = await lucid
  .newTx()
  .collectFrom(userUtxos)
  .mintAssets({ [userNFT]: 1n, [refNFT]: 1n }, mintRdmr)
  .attachMintingPolicy(mintValidator.validator)
  .payToAddress(userAddr, { [userNFT]: 1n })
  .payToContract(storeValidator.lockAddress, { inline: metadatum }, {
    [refNFT]: 1n,
  })
  .addSigner(issuerAddr)
  .addSigner(userAddr)
  .validFrom(Date.now() - 60 * 1000) // Substracting 1 minute to offset diff (blockfrost server time - local system time)
  .validTo(Date.now() + 15 * 60 * 1000)
  .complete({
    change: { address: userAddr },
    coinSelection: false, // Setting to false to avoid using distributor funds
  });

const partialSignedTx = await tx.partialSign();

lucid.selectWalletFromPrivateKey(await getCredential("user.sk"));

const signedTx = await lucid
  .fromTx(tx.toString())
  .assemble([partialSignedTx])
  .sign()
  .complete();

const txHash = await signedTx.submit();
await lucid.awaitTx(txHash);

console.log(
  `Successfully minted CIP-68 NFT: ${userNFT}(Ref NFT: ${refNFT})
storeAddress: ${storeValidator.lockAddress},
to userAddress: ${userAddr},
token: ${mintValidator.policyId},
txHash: ${txHash}`,
);

// Returns a `Unit` by creating a unique asset name using a utxo's txid and idx
// The asset label (as per CIP68) is then prefixed to the name
async function getUniqueAssetName(utxo: UTxO): Promise<string> {
  const hash = new Uint8Array(
    await crypto.subtle.digest(
      "SHA3-256",
      fromHex(utxo.txHash),
    ),
  );

  // Create unique asset name suffix of 28 bytes. The remaining 4 bytes come
  // from the asset label as a prefix.
  return toHex(new Uint8Array([utxo.outputIndex])) +
    toHex(hash.slice(0, 27));
}
