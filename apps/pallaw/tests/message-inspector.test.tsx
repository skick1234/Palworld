import { fireEvent, render, screen } from "@solidjs/testing-library";
import { describe, expect, test, vi } from "vitest";
import { MessageInspector } from "../src/ui/MessageInspector";

const message = {
  enabled: true,
  cooldownSeconds: 2,
  chat: { enabled: false, text: "Denied in {region}." },
  alerts: {
    brief: { enabled: true, text: "Denied", tone: "negative" },
    activity: { enabled: false, text: "Denied" }
  }
};

describe("MessageInspector", () => {
  test("reports a chat-channel toggle as an intent", async () => {
    const change = vi.fn();
    render(() => <MessageInspector messages={{ enabled: true, actionNames: {}, actionDenied: message }} resolved={{ actionDenied: message }} selectedEventId="actionDenied" modeName="Safe" onChange={change} />);

    await fireEvent.click(screen.getByLabelText("Enable System chat"));
    expect(change).toHaveBeenCalledWith({ type: "set-chat-enabled", eventId: "actionDenied", value: true });
  });
});
