import { Blockfrost, Lucid } from "lucid";
import { BLOCKFROST_URL, NETWORK } from "../../common/constants.ts";

const lucid = await Lucid.new(
  new Blockfrost(BLOCKFROST_URL, await Deno.env.get("BLOCKFROST_API_KEY")),
  NETWORK,
);

lucid.selectWalletFromPrivateKey(await Deno.readTextFile("./provider.sk"));

const asset = { lovelace: 5000000n };
const receiver = await Deno.readTextFile("./distributor.addr");

const tx = await lucid
  .newTx()
  .payToAddress(receiver, asset)
  .complete();

const signedTx = await tx.sign().complete();

const txHash = await signedTx.submit();

await lucid.awaitTx(txHash);

console.log(`Successfully sent 5 ADA
to address: ${receiver}
txHash: ${txHash}`);
