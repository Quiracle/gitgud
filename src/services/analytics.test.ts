import { describe, expect, it } from "vitest";
import { analyticsCookieNames, cookieDomains } from "./analytics";

describe("analytics cookie cleanup", () => {
  it("finds only Google Analytics cookies", () => {
    expect(analyticsCookieNames("_ga=GA1.1.1; theme=dark; _ga_528GL04RST=GS1; _gat=1")).toEqual(["_ga", "_ga_528GL04RST"]);
    expect(analyticsCookieNames("")).toEqual([]);
  });

  it("tries the host and every parent domain Google may have used", () => {
    expect(cookieDomains("www.gitgudgame.lol")).toEqual(["", ".www.gitgudgame.lol", ".gitgudgame.lol"]);
    expect(cookieDomains("localhost")).toEqual([""]);
  });
});
