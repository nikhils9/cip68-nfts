import { Data, Script } from "lucid";

export type AppliedValidator = {
  validator: Script;
  policyId: string;
  lockAddress: string;
  params: Data[];
};
