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
  reasoning: {
    key: "reasoning",
    name: "Reasoning",
    description: "Advanced reasoning capabilities",
    icon: Brain,
    enabled: true,
    category: "capability",
  },
  functionCalling: {
    key: "functionCalling",
    name: "Tools",
    description: "Tool calling support",
    icon: Zap,
    enabled: true,
    category: "capability",
  },
  imageInput: {
    key: "imageInput",
    name: "Vision",
    description: "Supports image input",
    icon: Eye,
    enabled: true,
    category: "input",
  },
  pdfInput: {
    key: "pdfInput",
    name: "PDF",
    description: "Supports PDF input",
    icon: FileText,
    enabled: true,
    category: "input",
  },
  audioInput: {
    key: "audioInput",
    name: "Audio Input",
    description: "Supports audio input",
    icon: Mic,
    // Not available yet
    enabled: false,
    category: "input",
  },
  imageOutput: {
    key: "imageOutput",
    name: "Image Output",
    description: "Supports image generation",
    icon: Image,
    // Not available yet
    enabled: false,
    category: "output",
  },
  audioOutput: {
    key: "audioOutput",
    name: "Audio Output",
    description: "Supports audio generation",
    icon: Mic,
    // Not available yet
    enabled: false,
    category: "output",
  },
} as const;

// Get only enabled features
export const getEnabledFeatures = () =>
  Object.values(AVAILABLE_FEATURES).filter((feature) => feature.enabled);
