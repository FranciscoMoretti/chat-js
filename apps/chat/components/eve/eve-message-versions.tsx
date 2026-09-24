"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { MessageSiblingsView } from "@/components/message-siblings-view";
import type { EveMessageSiblingNavigation } from "@/lib/eve/fork-source";

export const EveMessageVersions = ({
  navigation,
  disabled,
}: {
  navigation?: EveMessageSiblingNavigation;
  disabled: boolean;
}) => {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const navigate = (offset: number) => {
    const sibling = navigation?.siblings[navigation.currentIndex + offset];
    if (disabled || navigating || !sibling) {
      return;
    }
    startNavigation(() => {
      router.push(`/chat/${sibling.conversationId}`, { scroll: false });
    });
  };
  return (
    <MessageSiblingsView
      count={navigation?.siblings.length ?? 0}
      disabled={disabled || navigating}
      index={navigation?.currentIndex ?? 0}
      onNext={() => navigate(1)}
      onPrevious={() => navigate(-1)}
    />
  );
};
