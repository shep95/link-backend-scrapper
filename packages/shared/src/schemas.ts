import { z } from "zod";
import { isValidScanTarget } from "./targetValidation.js";

export const SeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const ScanCreateSchema = z.object({
  mode: z.enum(["surface", "web", "full"]).default("surface"),
  targets: z
    .array(
      z
        .string()
        .min(1)
        .refine(isValidScanTarget, "Target must be a public http(s) host or URL (private/reserved addresses blocked)")
    )
    .min(1),
  options: z
    .object({
      maxConcurrencyPerHost: z.number().int().min(1).max(50).optional(),
      maxRpsPerHost: z.number().min(0.1).max(50).optional(),
      maxCrawlDepth: z.number().int().min(0).max(20).optional(),
      maxUrlsPerHost: z.number().int().min(1).max(50_000).optional(),
      ports: z.array(z.number().int().min(1).max(65535)).optional(),
      wordlist: z.enum(["small", "medium"]).optional()
    })
    .default({})
});

export type ScanCreateInput = z.infer<typeof ScanCreateSchema>;
