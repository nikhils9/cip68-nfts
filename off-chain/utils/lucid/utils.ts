import { CREDENTIALS_PATH, NETWORK } from "../../common/constants.ts";
import { AppliedValidator } from "../../common/types.ts";
import {
  addAssets,
  applyDoubleCborEncoding,
  applyParamsToScript,
  Assets,
  Lucid,
  Script,
  UTxO,
} from "lucid";

const lucid = await Lucid.new(undefined, NETWORK);

// Credentials related utilities

export async function generateNewWallet(
  walletName: string,
  walletPath?: string,
) {
  let path = CREDENTIALS_PATH;
  if (walletPath) {
    path = walletPath;
  }

  const privateKey = lucid.utils.generatePrivateKey();
  await Deno.writeTextFile(path + walletName + ".sk", privateKey);

  const address = await lucid.selectWalletFromPrivateKey(privateKey).wallet
    .address();
  await Deno.writeTextFile(path + walletName + ".addr", address);
}

export async function getCredential(fileName: string, filePath?: string) {
  let path = CREDENTIALS_PATH;

  if (filePath) {
    path = filePath;
  }

  return await Deno.readTextFile(path + fileName);
}

export function getPublicKeyHash(address: string) {
  return lucid.utils.getAddressDetails(address).paymentCredential?.hash;
}

// UTxOs related utilities

export function sumUtxos(utxos: UTxO[]): Assets {
  return utxos
    .map((utxo) => utxo.assets)
    .reduce((acc, assets) => addAssets(acc, assets), {});
}

// Validator related utilities

export function parseValidator(validators: any, title: string): Script {
  const validator = validators.find((e: any) => e.title === title);

  if (!validator) {
    throw new Error(title + " validator not found!");
  }

  return {
    type: "PlutusV2",
    script: validator.compiledCode,
  };
}

export function parseValidatorAndApplyParameters(
  validators: any,
  params: [any],
  title: string,
): AppliedValidator {
  const validator = parseValidator(validators, title);
  return applyValidatorParameters(validator, params, title);
}

export function applyValidatorParameters(
  rawValidator: Script,
  params: [any],
  title: string,
): AppliedValidator {
  const compiledCode = applyParamsToScript(rawValidator.script, params);
  const validator: Script = {
    type: "PlutusV2",
    script: applyDoubleCborEncoding(compiledCode),
  };

  const policyId = lucid.utils.validatorToScriptHash(validator);

  const lockAddress = lucid.utils.validatorToAddress(validator);

  const appliedValidator: AppliedValidator = {
    validator: validator,
    policyId: policyId,
    lockAddress: lockAddress,
    params: params,
  };

  const appliedValidatorString = JSON.stringify(
    appliedValidator,
    bigIntReplacer,
  );
  console.log(appliedValidatorString);

  Deno.writeTextFile(title + "_applied_validator.json", appliedValidatorString);

  return appliedValidator;
}

// Parameter to 'JSON.stringify()' to help with bigint conversion
export function bigIntReplacer(_k: any, v: any) {
  return typeof v === "bigint" ? v.toString() : v;
}
