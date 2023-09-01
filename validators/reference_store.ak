use aiken/hash.{Blake2b_224, Hash}
use aiken/list
use aiken/transaction.{InlineDatum, Output, ScriptContext, Spend}
use aiken/transaction/credential.{Address, VerificationKey}
use aiken/transaction/value.{Value}
use assist/signing
use assist/values
use cip68_nfts/types.{MetaDatum, Remove, StoreAction, Update}

validator(issuer: Hash<Blake2b_224, VerificationKey>) {
  fn store(_datum: MetaDatum, rdmr: StoreAction, ctx: ScriptContext) -> Bool {
    let tx = ctx.transaction
    when rdmr is {
      Update -> {
        expect Spend(output_reference) = ctx.purpose
        // The input being spent containing the reference nft.
        // Assumption being that this contract only has CIP68 reference nfts locked in it
        // and each utxo holds exactly one refrence nft.
        expect Some(input) = transaction.find_input(tx.inputs, output_reference)
        let ref_nft =
          input.output.value
            |> value.without_lovelace()
        let script_addr = input.output.address

        // Find the output containing reference nft being sent back to this script itself
        // Fail if no such output is found. Reference nft must never leave the contract 
        // if the intention was to just update the nft metadata
        let validating_output =
          output_by_addr_value(tx.outputs, script_addr, ref_nft)

        // Check inline datum exists and conforms to MetaDatum as per CIP68
        expect InlineDatum(data) = validating_output.datum
        expect _metadatum: MetaDatum = data

        let output_value =
          validating_output.value
            |> value.without_lovelace()
            |> value.flatten()

        and {
          signing.verify_sig(tx.extra_signatories, issuer),
          // Check no other token is present in the utxo containing reference nft
          list.length(output_value) == 1,
        }
      }
      Remove ->
        // Check if the transaction is signed by issuer and allow them to remove
        // any asset that they wish.
        signing.verify_sig(tx.extra_signatories, issuer)
    }
  }
}

/// Return the first occurrence of an output that contains at least some specific
/// value at some address. If nothing is found then error. This function
/// does not search for an exact UTxO match.
///
/// ```aiken
/// find.output_by_addr_value(tx.outputs, wallet_addr, just_token_value)
/// ```
fn output_by_addr_value(
  outputs: List<Output>,
  addr: Address,
  value: Value,
) -> Output {
  when outputs is {
    [output, ..rest] ->
      if output.address == addr && values.contains(value, output.value) {
        output
      } else {
        output_by_addr_value(rest, addr, value)
      }
    // nothing was found
    [] -> fail @"No Output found"
  }
}
