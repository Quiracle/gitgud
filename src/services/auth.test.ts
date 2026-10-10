import { describe, expect, it } from "vitest";
import { normalizeReturnPath, toAuthUser } from "./auth";

describe("auth helpers", () => {
  it("allows only local return paths", () => {
    expect(normalizeReturnPath("/play")).toBe("/play");
    expect(normalizeReturnPath("/course/log?from=auth")).toBe("/course/log?from=auth");
    expect(normalizeReturnPath("https://attacker.example")).toBe("/");
    expect(normalizeReturnPath("//attacker.example")).toBe("/");
    expect(normalizeReturnPath("/\\attacker.example")).toBe("/");
  });

  it("maps safe public identity fields without using email as a display name", () => {
    const user = {
      id: "12345678-abcd-0000-0000-000000000000",
      app_metadata: { provider: "github" },
      user_metadata: { user_name: "octochicken", avatar_url: "https://example.com/avatar.png" },
    };

    expect(toAuthUser(user as never)).toEqual({
      id: user.id,
      displayName: "octochicken",
      avatarUrl: "https://example.com/avatar.png",
      provider: "github",
    });
  });

  it("uses a non-email fallback display name", () => {
    const user = {
      id: "12345678-abcd-0000-0000-000000000000",
      email: "private@example.com",
      app_metadata: {},
      user_metadata: {},
    };

    expect(toAuthUser(user as never).displayName).toBe("Player 12345678");
  });
});
