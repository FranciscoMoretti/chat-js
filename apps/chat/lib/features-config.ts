import type { LucideIcon } from "lucide-react";
import { Brain, Eye, FileText, Image, Mic, Zap } from "lucide-react";

interface FeatureConfig {
  category: "capability" | "input" | "output";
  description: string;
  enabled: boolean;
  icon: LucideIcon;
  key: string;
  name: string;
}

export const AVAILABLE_FEATURES: Record<string, FeatureConfig> = {
  audioInput: {
    category: "input",
    description: "Supports audio input",
    // Not available yet
    enabled: false,
    icon: Mic,
    key: "audioInput",
    name: "Audio Input",
  },
  audioOutput: {
    category: "output",
    description: "Supports audio generation",
    // Not available yet
    enabled: false,
    icon: Mic,
    key: "audioOutput",
    name: "Audio Output",
  },
  functionCalling: {
    category: "capability",
    description: "Tool calling support",
    enabled: true,
    icon: Zap,
    key: "functionCalling",
    name: "Tools",
  },
  imageInput: {
    category: "input",
    description: "Supports image input",
    enabled: true,
    icon: Eye,
    key: "imageInput",
    name: "Vision",
  },
  imageOutput: {
    category: "output",
    description: "Supports image generation",
    // Not available yet
    enabled: false,
    icon: Image,
    key: "imageOutput",
    name: "Image Output",
  },
  pdfInput: {
    category: "input",
    description: "Supports PDF input",
    enabled: true,
    icon: FileText,
    key: "pdfInput",
    name: "PDF",
  },
  reasoning: {
    category: "capability",
    description: "Advanced reasoning capabilities",
    enabled: true,
    icon: Brain,
    key: "reasoning",
    name: "Reasoning",
  },
} as const;

// Get only enabled features
export const getEnabledFeatures = () =>
  Object.values(AVAILABLE_FEATURES).filter((feature) => feature.enabled);
