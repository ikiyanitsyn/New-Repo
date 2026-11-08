import { describe, expect, it } from "vitest";
import { activeTab } from "../../components/nav/tabs";

describe("phone tab bar", () => {
  it("lights the tab for the current screen", () => {
    expect(activeTab("#start", false)).toBe("home");
    expect(activeTab("#trip", false)).toBe("trip");
    expect(activeTab("#explore-beijing", false)).toBe("guide");
    expect(activeTab("#explore-beijing~Forbidden%20City", false)).toBe("guide");
    expect(activeTab("#concierge", false)).toBe("concierge");
    expect(activeTab("#trips", false)).toBe("account");
    expect(activeTab("#shared", false)).toBe("account");
    expect(activeTab("#share", false)).toBe("account");
  });

  it("treats a bare address as Home on the opening page and Trip otherwise", () => {
    expect(activeTab("", true)).toBe("home");
    expect(activeTab("", false)).toBe("trip");
  });

  it("explicit addresses win over the opening-page flag", () => {
    expect(activeTab("#start", false)).toBe("home");
    expect(activeTab("#concierge", true)).toBe("concierge");
    expect(activeTab("#trip", true)).toBe("trip");
  });
});
