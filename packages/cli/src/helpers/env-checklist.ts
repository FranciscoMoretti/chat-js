import {
	authEnvRequirements,
	builtInToolEnvRequirements,
	coreFeatureEnvRequirements,
	type EnvRequirement,
	envVarDescriptions,
	gatewayEnvRequirements,
} from "./config-requirements";
import {
	type AuthProvider,
	BUILT_IN_TOOL_KEYS,
	CORE_FEATURE_KEYS,
	type BuiltInToolKey,
	type CoreFeatureKey,
	type Gateway,
} from "../types";

type EnvRequirementLike = {
	description?: string;
	options: string[][];
};

export type EnvVarEntry = {
	/** The env var name(s), e.g. "AI_GATEWAY_API_KEY" or "AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET" */
	vars: string;
	/** Human-readable description derived from the Zod schema */
	description: string;
	/** Group key used to render "one of" alternatives together */
	oneOfGroup?: string;
};

const envDescriptions = new Map(Object.entries(envVarDescriptions));

/**
 * Expand an EnvRequirement into one or more EnvVarEntries, pulling
 * descriptions from the Zod schema.
 */
function requirementToEntries(requirement: EnvRequirementLike): EnvVarEntry[] {
	const oneOfGroup =
		requirement.options.length > 1
			? requirement.options
					.map((group) => group.map(String).join("+"))
					.join("|")
			: undefined;

	return requirement.options.map((group) => {
		const description = group
			.map((v) => {
				const varName = String(v);
				return envDescriptions.get(varName) ?? varName;
			})
			.join(", ");

		return {
			vars: group.map(String).join(" + "),
			description:
				description ||
				requirement.description ||
				"Required environment variable",
			oneOfGroup,
		};
	});
}

export function collectEnvChecklist(input: {
	gateway: Gateway;
	gatewayRequirements?: EnvRequirementLike[];
	coreFeatures: Record<CoreFeatureKey, boolean>;
	builtInTools: Record<BuiltInToolKey, boolean>;
	auth: Record<AuthProvider, boolean>;
	installableToolEnvRequirements?: EnvRequirementLike[];
}): EnvVarEntry[] {
	const entries: EnvVarEntry[] = [];

	entries.push({
		vars: "AUTH_SECRET",
		description: envDescriptions.get("AUTH_SECRET") ?? "AUTH_SECRET",
	});
	entries.push({
		vars: "DATABASE_URL",
		description: envDescriptions.get("DATABASE_URL") ?? "DATABASE_URL",
	});

	// --- AI Gateway ---
	const gwReq =
		input.gatewayRequirements ?? gatewayEnvRequirements[input.gateway] ?? [];
	const gwEntries = gwReq.flatMap(requirementToEntries);

	entries.push(...gwEntries);

	// --- Top-level features ---
	const featureItems: EnvVarEntry[] = [];
	const seen = new Set<string>();

	for (const feature of CORE_FEATURE_KEYS) {
		if (!input.coreFeatures[feature]) continue;
		const requirement =
			coreFeatureEnvRequirements[
				feature as keyof typeof coreFeatureEnvRequirements
			];
		if (!requirement) continue;

		// Deduplicate repeated env requirements across feature/tool selections.
		if (seen.has(requirement.description)) continue;
		seen.add(requirement.description);

		featureItems.push(...requirementToEntries(requirement));
	}

	for (const tool of BUILT_IN_TOOL_KEYS) {
		if (!input.builtInTools[tool]) continue;
		const requirement =
			builtInToolEnvRequirements[
				tool as keyof typeof builtInToolEnvRequirements
			];
		if (!requirement) continue;
		if (seen.has(requirement.description)) continue;
		seen.add(requirement.description);

		featureItems.push(...requirementToEntries(requirement));
	}

	for (const requirement of input.installableToolEnvRequirements ?? []) {
		const dedupeKey =
			requirement.description ??
			requirement.options.map((option) => option.join("+")).join("|");
		if (seen.has(dedupeKey)) continue;
		seen.add(dedupeKey);

		featureItems.push(...requirementToEntries(requirement));
	}

	entries.push(...featureItems);

	// --- Authentication ---
	const authItems: EnvVarEntry[] = [];

	for (const provider of Object.keys(authEnvRequirements) as AuthProvider[]) {
		if (!input.auth[provider]) continue;
		authItems.push(...requirementToEntries(authEnvRequirements[provider]));
	}

	entries.push(...authItems);

	return entries;
}
