import { Constr, Data, fromText, toUnit } from "lucid";
import {
  createLucidInstance,
  getAppliedValidator,
  getCredential,
  getUtxoWithAssets,
} from "./utils/lucid/utils.ts";
import { REFERENCE_TOKEN_LABEL } from "./common/constants.ts";
import { MetaDatum } from "./common/types.ts";

const lucid = await createLucidInstance();
lucid.selectWalletFromPrivateKey(await getCredential("issuer.sk"));

const storeValidator = await getAppliedValidator("reference_store.store.json");
const storeUtxos = await lucid.utxosAt(storeValidator.lockAddress);
const mintValidator = await getAppliedValidator("mint.mint.json");

const assetNameSuffix =
  "004e80f65697e1332fbb75f5a4a0927f5856ade4df76b64bd762a2f6";
const refToken = toUnit(
  mintValidator.policyId,
  assetNameSuffix,
  REFERENCE_TOKEN_LABEL,
);
const refUtxo = getUtxoWithAssets(storeUtxos, { [refToken]: 1n });

let metaDatum: MetaDatum;
try {
  metaDatum = Data.from<MetaDatum>(refUtxo.datum!, MetaDatum);
  const metadata = metaDatum?.metadata;
  metadata?.set(fromText("name"), fromText("BlockOwls Telly Updated"));
  metadata?.set(fromText("power"), 1000n);
} catch (error) {
  console.error(
    `Error occured while deserializing UTxO datum at refToken(${refToken} to MetaDatum. 
    Datum: ${refUtxo.datum}` + error.message,
  );
}

const rdmr = Data.to(new Constr(0, []));

const tx = await lucid
  .newTx()
  .collectFrom([refUtxo], rdmr)
  .payToContract(storeValidator.lockAddress, {
    inline: Data.to<MetaDatum>(metaDatum!, MetaDatum),
  }, { [refToken]: 1n })
  .attachSpendingValidator(storeValidator.validator)
  .addSigner(await lucid.wallet.address())
  .complete();

const signedTx = await tx.sign().complete();
const txHash = await signedTx.submit();

console.log(
  `Successfully updated CIP-68 Reference NFT: ${refToken},
  storeAddress: ${storeValidator.lockAddress},
  token: ${mintValidator.policyId},
  txHash: ${txHash}`,
);
