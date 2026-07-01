import { z } from "zod";
import { supabase } from "./supabase";

export const tableVerificationSchema = z.object({
  tableNumber: z.coerce.number().int().positive({ message: "Table number must be a positive integer" }),
  token: z.string().min(8).max(128).regex(/^[a-fA-F0-9]+$/, { message: "Invalid characters in token" }),
});

export async function verifyTableToken(tableNumber: number, token: string): Promise<boolean> {
  const validation = tableVerificationSchema.safeParse({ tableNumber, token });
  if (!validation.success) {
    return false;
  }

  const { data } = await supabase.rpc("verify_table_token", {
    p_table_number: validation.data.tableNumber,
    p_token: validation.data.token,
  });

  return !!data;
}
