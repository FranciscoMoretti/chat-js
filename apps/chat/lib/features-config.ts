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
    category: "capability",
    description: "Advanced reasoning capabilities",
    enabled: true,
    icon: Brain,
    key: "reasoning",
    name: "Reasoning",
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
  pdfInput: {
    category: "input",
    description: "Supports PDF input",
    enabled: true,
    icon: FileText,
    key: "pdfInput",
    name: "PDF",
  },
  audioInput: {
    category: "input",
    description: "Supports audio input",
    enabled: false,
    icon: Mic,
    key: "audioInput",
    name: "Audio Input",
  },
  imageOutput: {
    category: "output",
    description: "Supports image generation",
    enabled: false,
    icon: Image,
    key: "imageOutput",
    name: "Image Output",
  },
  audioOutput: {
    category: "output",
    description: "Supports audio generation",
    enabled: false,
    icon: Mic,
    key: "audioOutput",
    name: "Audio Output",
  },
} as const;

// Get only enabled features
export const getEnabledFeatures = () =>
  Object.values(AVAILABLE_FEATURES).filter((feature) => feature.enabled);
