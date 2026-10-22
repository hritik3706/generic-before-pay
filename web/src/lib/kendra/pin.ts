import rows from "@/data/kendras.json";

export type ListedKendra = {
  id: string;
  name: string;
  state: string;
  district: string;
  pin: string;
  address: string;
};

const LIST = rows as ListedKendra[];

/** Published PMBJP Kendra directory. No phone numbers and no map coordinates are in this copy. */
export function kendrasForPin(pin: string): ListedKendra[] | "invalid" {
  const cleaned = pin.trim();
  if (!/^\d{6}$/.test(cleaned)) return "invalid";
  return LIST.filter((row) => row.pin === cleaned);
}
