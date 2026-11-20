// The counter-offer copy button's logic, with a stand-in clipboard (the browser is the boundary).
import { describe, expect, it } from "vitest";
import { copyText, type ClipboardLike } from "../../app/analysis/copy-text.ts";
import { loadContract } from "../support/fake-model.ts";

const { sidecar } = loadContract("one-sided-services-agreement");

function recordingClipboard(): ClipboardLike & { written: string[] } {
  const written: string[] = [];
  return { written, writeText: async (text: string) => void written.push(text) };
}

describe("copyText", () => {
  it("copies exactly the counter-offer string, nothing added or trimmed", async () => {
    const clipboard = recordingClipboard();
    for (const flag of sidecar.flags) {
      expect(await copyText(clipboard, flag.counterOffer)).toBe("copied");
    }
    expect(clipboard.written).toEqual(sidecar.flags.map((flag) => flag.counterOffer));

    const padded = "  Client shall pay within thirty (30) days.\n";
    await copyText(clipboard, padded);
    expect(clipboard.written.at(-1)).toBe(padded);
  });

  it("returns failed when the clipboard rejects, without throwing", async () => {
    const refusing: ClipboardLike = { writeText: () => Promise.reject(new DOMException("denied", "NotAllowedError")) };
    expect(await copyText(refusing, "text")).toBe("failed");
  });

  it("returns failed when writeText throws synchronously", async () => {
    const throwing = {
      writeText: () => {
        throw new Error("no");
      },
    } as unknown as ClipboardLike;
    expect(await copyText(throwing, "text")).toBe("failed");
  });

  it("returns failed when there is no clipboard API", async () => {
    expect(await copyText(undefined, "text")).toBe("failed");
    expect(await copyText(null, "text")).toBe("failed");
    expect(await copyText({} as ClipboardLike, "text")).toBe("failed");
  });
});
