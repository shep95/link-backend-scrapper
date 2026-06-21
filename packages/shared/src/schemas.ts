import { z } from "zod";

export const SeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const ScanCreateSchema = z.object({
  mode: z.enum(["surface", "web", "full"]).default("full"),
  targets: z.array(z.string().min(1)).min(1),
  options: z
    .object({
      maxConcurrencyPerHost: z.number().int().min(1).max(200).optional(),
      maxRpsPerHost: z.number().min(0.1).max(200).optional(),
      maxCrawlDepth: z.number().int().min(0).max(20).optional(),
      maxUrlsPerHost: z.number().int().min(1).max(500000).optional(),
      ports: z.array(z.number().int().min(1).max(65535)).optional(),
      wordlist: z.enum(["small", "medium"]).optional()
    })
    .default({})
});

export type ScanCreateInput = z.infer<typeof ScanCreateSchema>;
