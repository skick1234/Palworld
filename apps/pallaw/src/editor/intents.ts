export type ActionIntentValue = boolean | "all" | "baseOnly" | "baseToAll" | "baseToBase" | "allToBase" | "none";
export type CombatIntentValue = "default" | "allow" | "deny";

export type MessageIntent =
  | { readonly type: "set-messages-enabled"; readonly value: boolean }
  | { readonly type: "set-override"; readonly eventId: string; readonly value: boolean }
  | { readonly type: "set-event-enabled"; readonly eventId: string; readonly value: boolean }
  | { readonly type: "set-cooldown"; readonly eventId: string; readonly value: number }
  | { readonly type: "set-chat-enabled"; readonly eventId: string; readonly value: boolean }
  | { readonly type: "set-chat-text"; readonly eventId: string; readonly value: string }
  | { readonly type: "set-alert-enabled"; readonly eventId: string; readonly presentation: string; readonly value: boolean }
  | { readonly type: "set-alert-text"; readonly eventId: string; readonly presentation: string; readonly value: string }
  | { readonly type: "set-alert-tone"; readonly eventId: string; readonly presentation: string; readonly value: string };

export type AreaIntent =
  | { readonly type: "set-name"; readonly value: string }
  | { readonly type: "set-mode"; readonly value: string }
  | { readonly type: "set-enabled"; readonly value: boolean }
  | { readonly type: "set-map"; readonly value: string }
  | { readonly type: "set-minimum-level"; readonly value: number | null }
  | { readonly type: "set-polygon"; readonly value: readonly (readonly [number, number])[] }
  | { readonly type: "fit-region" }
  | { readonly type: "set-action"; readonly actionId: string; readonly value: ActionIntentValue | null }
  | { readonly type: "set-combat"; readonly source: string; readonly target: string; readonly value: CombatIntentValue }
  | { readonly type: "reset-combat" }
  | { readonly type: "message"; readonly intent: MessageIntent };

export type ModeIntent =
  | { readonly type: "set-name"; readonly value: string }
  | { readonly type: "set-color"; readonly value: string }
  | { readonly type: "set-minimum-level"; readonly value: number | null }
  | { readonly type: "set-action"; readonly actionId: string; readonly value: ActionIntentValue | null }
  | { readonly type: "set-combat"; readonly source: string; readonly target: string; readonly value: CombatIntentValue }
  | { readonly type: "message"; readonly intent: MessageIntent };
