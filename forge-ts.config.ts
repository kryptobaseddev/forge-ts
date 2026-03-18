import type { ForgeConfig } from "@codluv/forge-core";

export default {
	rootDir: ".",
	tsconfig: "./tsconfig.json",
	outDir: "./docs/generated",
	enforce: {
		enabled: true,
		minVisibility: "public",
		strict: false,
	},
	doctest: {
		enabled: true,
		cacheDir: ".cache/doctest",
	},
	api: {
		enabled: true,
		openapi: true,
		openapiPath: "./docs/generated/openapi.json",
	},
	gen: {
		enabled: true,
		formats: ["markdown"],
		llmsTxt: true,
		readmeSync: false,
		ssgTarget: "vitepress",
	},
} satisfies Partial<ForgeConfig>;
