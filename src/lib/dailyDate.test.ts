import { describe, expect, it } from "vitest";
import { dailyDate } from "./dailyDate";

describe("dailyDate", () => {
  it("keeps UTC days before the switch to Barcelona time", () => {
    expect(dailyDate("2026-10-10T23:30:00Z")).toBe("2026-10-10");
    expect(dailyDate(new Date("2026-10-10T23:59:59-07:00"))).toBe("2026-10-11");
  });

  it("starts the first Barcelona day at its local midnight", () => {
    expect(dailyDate("2026-10-12T21:59:59Z")).toBe("2026-10-12");
    expect(dailyDate("2026-10-12T22:00:00Z")).toBe("2026-10-13");
  });

  it("follows Barcelona summer and winter time", () => {
    // CEST (UTC+2): midnight is 22:00 UTC.
    expect(dailyDate("2026-10-20T21:59:59Z")).toBe("2026-10-20");
    expect(dailyDate("2026-10-20T22:00:00Z")).toBe("2026-10-21");
    // CET (UTC+1): midnight is 23:00 UTC.
    expect(dailyDate("2026-12-01T22:59:59Z")).toBe("2026-12-01");
    expect(dailyDate("2026-12-01T23:00:00Z")).toBe("2026-12-02");
  });
});
