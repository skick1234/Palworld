import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
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
  afterEach(cleanup);

  test("reports the global message control as an intent", async () => {
    const change = vi.fn();
    render(() => <MessageInspector messages={{ enabled: true, actionNames: {}, actionDenied: message }} resolved={{ actionDenied: message }} selectedEventId="actionDenied" modeName="Safe" onChange={change} />);

    await fireEvent.click(screen.getByLabelText("Enable all messages"));
    expect(change).toHaveBeenCalledWith({ type: "set-messages-enabled", value: false });
  });

  test("reports a chat-channel toggle as an intent", async () => {
    const change = vi.fn();
    render(() => <MessageInspector messages={{ enabled: true, actionNames: {}, actionDenied: message }} resolved={{ actionDenied: message }} selectedEventId="actionDenied" modeName="Safe" onChange={change} />);

    await fireEvent.click(screen.getByLabelText("Enable System chat"));
    expect(change).toHaveBeenCalledWith({ type: "set-chat-enabled", eventId: "actionDenied", value: true });
  });

  test("previews and counts only visible Message Outputs", () => {
    const outputs = {
      ...message,
      chat: { enabled: true, text: " \t\r\n" },
      alerts: {
        brief: { enabled: true, text: "", tone: "negative" },
        activity: { enabled: true, text: "Visible tip" }
      }
    };
    render(() => <MessageInspector messages={{ enabled: true, actionNames: {}, actionDenied: outputs }} resolved={{ actionDenied: outputs }} selectedEventId="actionDenied" modeName="Safe" onChange={vi.fn()} />);

    expect(screen.getByText("1 outputs")).toBeTruthy();
    expect(screen.getByText("Visible tip")).toBeTruthy();
    expect(screen.queryByText(/^Chat:/)).toBeNull();
  });

  test("shows a no-visible-output state when every enabled output is silent", () => {
    const outputs = {
      ...message,
      chat: { enabled: true, text: "" },
      alerts: {
        brief: { enabled: true, text: " \t" },
        activity: { enabled: false, text: "Configured but disabled" }
      }
    };
    render(() => <MessageInspector messages={{ enabled: true, actionNames: {}, actionDenied: outputs }} resolved={{ actionDenied: outputs }} selectedEventId="actionDenied" modeName="Safe" onChange={vi.fn()} />);

    expect(screen.getByText("0 outputs")).toBeTruthy();
    expect(screen.getByText("No visible outputs.")).toBeTruthy();
  });
});
