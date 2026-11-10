import specs from "@/data/specs.json";
import industries from "@/data/industries.json";

export const SPECS = specs;
export const INDUSTRIES = industries.industries;
export type IndustryId = (typeof INDUSTRIES)[number]["id"];
