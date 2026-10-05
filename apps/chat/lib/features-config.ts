import { Brain, Eye, FileText, Image, Mic, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface FeatureConfig {
  category: "capability" | "input" | "output";
  description: string;
  enabled: boolean;
  icon: LucideIcon;
  key: string;
  name: string;
  order: number;
}

const AVAILABLE_FEATURES: Record<string, FeatureConfig> = {
  audioInput: {
    category: "input",
    description: "Supports audio input",
    enabled: false,
    icon: Mic,
    key: "audioInput",
    name: "Audio Input",
    order: 4,
  },
  audioOutput: {
    category: "output",
    description: "Supports audio generation",
    enabled: false,
    icon: Mic,
    key: "audioOutput",
    name: "Audio Output",
    order: 6,
  },
  functionCalling: {
    category: "capability",
    description: "Tool calling support",
    enabled: true,
    icon: Zap,
    key: "functionCalling",
    name: "Tools",
    order: 1,
  },
  imageInput: {
    category: "input",
    description: "Supports image input",
    enabled: true,
    icon: Eye,
    key: "imageInput",
    name: "Vision",
    order: 2,
  },
  imageOutput: {
    category: "output",
    description: "Supports image generation",
    enabled: false,
    icon: Image,
    key: "imageOutput",
    name: "Image Output",
    order: 5,
  },
  pdfInput: {
    category: "input",
    description: "Supports PDF input",
    enabled: true,
    icon: FileText,
    key: "pdfInput",
    name: "PDF",
    order: 3,
  },
  reasoning: {
    category: "capability",
    description: "Advanced reasoning capabilities",
    enabled: true,
    icon: Brain,
    key: "reasoning",
    name: "Reasoning",
    order: 0,
  },
} as const;

/* oxlint-disable typescript/prefer-readonly-parameter-types -- typescript/prefer-readonly-parameter-types (#565): getEnabledFeatures accepts feature; left; right; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
// Get only enabled features
const getEnabledFeatures = (): FeatureConfig[] =>
  Object.values(AVAILABLE_FEATURES)
    .filter((feature) => feature.enabled)
    .toSorted((left, right) => left.order - right.order);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (AVAILABLE_FEATURES, getEnabledFeatures); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
export { AVAILABLE_FEATURES, getEnabledFeatures };
/* oxlint-enable import/no-named-export */
