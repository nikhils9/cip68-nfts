// deno-lint-ignore-file no-explicit-any
import { Constr, Data, fromHex, fromText, toHex, toUnit, UTxO } from "lucid";
import { createLucidInstance, getCredential } from "./utils/lucid/utils.ts";
import { crypto } from "crypto";
import {
  APPLIED_VALIDATOR_PATH,
  NON_FUNGIBLE_TOKEN_LABEL,
  REFERENCE_TOKEN_LABEL,
} from "./common/constants.ts";
import { AppliedValidator, MetaDatum } from "./common/types.ts";

const lucid = await createLucidInstance();

const storeValidator: AppliedValidator = JSON.parse(
  await Deno.readTextFile(
    APPLIED_VALIDATOR_PATH + "reference_store.store.json",
  ),
);
const scriptUtxos = await lucid.utxosAt(storeValidator.lockAddress);

lucid.selectWalletFromPrivateKey(await getCredential("issuer.sk"));

const userAddr = await getCredential("user.addr");
const rdmr = Data.to(new Constr(1, []));
const utxo = scriptUtxos[0];

const tx = lucid
  .newTx()
  .collectFrom(scriptUtxos, rdmr)
  .payToAddressWithData(userAddr, { inline: utxo.datum! }, utxo.assets);

// scriptUtxos.forEach((utxo) => {
//   if (utxo.datum) {
//     tx.payToAddressWithData(userAddr, { inline: utxo.datum }, utxo.assets);
//     // console.log(utxo.datum);
//     // console.log(Data.from(utxo.datum));
//   } else console.log("UTxO without datum found" + utxo);
// });

const completedTx = await tx.addSigner(await lucid.wallet.address())
  .attachSpendingValidator(storeValidator.validator)
  .complete();

const signedTx = await completedTx.sign().complete();
const txHash = await signedTx.submit();
await lucid.awaitTx(txHash);

console.log(
  `Successfully removed all assets from
storeAddress: ${storeValidator.lockAddress},
to userAddress: ${userAddr},
txHash: ${txHash}`,
);
