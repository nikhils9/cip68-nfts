import { createLucidInstance, getCredential } from "../lucid/utils.ts";

const lucid = await createLucidInstance();

lucid.selectWalletFromPrivateKey(await getCredential("user.sk"));

//const asset = { lovelace: 5000000n };
const token = {
  ["781b0f6aee558273d74cf7ffad4454a08dc5ea5d7bde73a29fdd990d000de14001cd485e2906baadd152a75b51835ccf876df02b25470c26151ba02b"]:
    1n,
};
// const receiver = await getCredential("issuer.addr");
const receiver =
  "addr_test1qrmdrjfxyzzda9rcq459lljmmke0jffnttpvu2za5zpr7p4za8cfdkfad86l0yyn0vdmrqu66dt6zafasg85laeqe6uqd248et";

const tx = await lucid
  .newTx()
  .payToAddress(receiver, token)
  .complete();

const signedTx = await tx.sign().complete();

const txHash = await signedTx.submit();

await lucid.awaitTx(txHash);

console.log(`Successfully sent 5 ADA
to address: ${receiver}
txHash: ${txHash}`);
