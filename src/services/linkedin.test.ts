import { describe, expect, it, vi } from "vitest";
import { LinkedInError, SupabaseLinkedInService } from "./linkedin";

/** Just enough of SupabaseClient for the service: a session and the function invoker. */
function fakeClient(options: { signedIn?: boolean; invoke?: (body: Record<string, unknown>) => unknown }) {
  const invoke = vi.fn(async (_name: string, { body }: { body: Record<string, unknown> }) => {
    try {
      return { data: await options.invoke?.(body), error: null };
    } catch (response) {
      return { data: null, error: { context: response } };
    }
  });
  const client = {
    auth: { getSession: async () => ({ data: { session: options.signedIn === false ? null : { access_token: "t" } } }) },
    functions: { invoke },
  };
  return { service: new SupabaseLinkedInService(client as never), invoke };
}

describe("LinkedIn service", () => {
  it("reports guests as signed out without calling the function", async () => {
    const { service, invoke } = fakeClient({ signedIn: false });
    expect(await service.status()).toEqual({ state: "signed-out" });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("maps the function's status answers", async () => {
    expect(await fakeClient({ invoke: () => ({ configured: false }) }).service.status()).toEqual({ state: "unavailable" });
    expect(await fakeClient({ invoke: () => ({ configured: true, connected: true, name: "Ada" }) }).service.status()).toEqual({
      state: "connected",
      name: "Ada",
    });
    expect(await fakeClient({ invoke: () => ({ configured: true, connected: false, expired: true }) }).service.status()).toEqual({
      state: "disconnected",
      expired: true,
    });
  });

  it("treats an unreachable function as unavailable so copy and download still work", async () => {
    const { service } = fakeClient({ invoke: () => { throw new Error("offline"); } });
    expect(await service.status()).toEqual({ state: "unavailable" });
  });

  it("sends the card as base64 PNG with the puzzle identity", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const { service, invoke } = fakeClient({ invoke: () => ({ postUrl: "https://www.linkedin.com/feed/update/urn:li:share:1/" }) });

    const result = await service.post({ puzzleId: "daily-2026-10-10", puzzleVersion: 1, text: "Solved!", image: new Blob([png], { type: "image/png" }) });

    expect(result.postUrl).toBe("https://www.linkedin.com/feed/update/urn:li:share:1/");
    expect(invoke).toHaveBeenCalledWith("linkedin-share", {
      body: { action: "post", puzzleId: "daily-2026-10-10", puzzleVersion: 1, text: "Solved!", image: "iVBORw0KGgo=" },
    });
  });

  it("refuses post links that don't point at LinkedIn", async () => {
    const { service } = fakeClient({ invoke: () => ({ postUrl: "https://attacker.example/" }) });
    await expect(service.post({ puzzleId: "p", puzzleVersion: 1, text: "x", image: new Blob([]) })).rejects.toBeInstanceOf(LinkedInError);
  });

  it("phrases the function's error code in the player's language", async () => {
    const { service } = fakeClient({
      invoke: () => {
        throw new Response(JSON.stringify({ error: "Connect LinkedIn to post.", code: "not_connected" }), { status: 401 });
      },
    });
    const error = await service.post({ puzzleId: "p", puzzleVersion: 1, text: "x", image: new Blob([]) }).catch((reason) => reason);
    expect(error).toBeInstanceOf(LinkedInError);
    expect(error.message).toBe("Your LinkedIn connection ended. Connect again to post.");
    expect(error.code).toBe("not_connected");
  });
});
