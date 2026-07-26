import type { Icon, IconProps } from "@phosphor-icons/react";

/** Phase A: Phosphor Regular only — consistent weight across client/marketing surfaces */
export const ICON = { weight: "regular" as const } satisfies Partial<IconProps>;

export type PhosphorIcon = Icon;
