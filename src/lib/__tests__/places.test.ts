import { describe, expect, it } from "vitest";
import { cleanText, districtLinks, parseListings, redirectTarget } from "../places/parse";

// Test fixture written in Wikivoyage's listing-template format (not copied from a real article).
const WIKITEXT = `
==Understand==
Some intro text with a {{see|name=Not a section listing}} reference.

==See==
===Temples===
* {{see
| name=Example Temple | alt={{lang|zh|示例寺}} | url=https://example.org/temple | email=
| address=1 Temple Rd | lat=30.67 | long=104.07 | directions=Metro Line 1, [[Example Station|Example Stn]]
| phone= | hours=08:00-17:00 | price=¥20
| wikipedia=Example Temple | image=Example temple.jpg
| content=A '''Tang-dynasty''' temple with a teahouse.<ref>source</ref> See [https://example.org photos].
}}
* {{listing | type=see | name=Old Street | lat= | long= | content=Lantern-lit lane.}}

==Eat==
===Budget===
* {{eat | name=Noodle Stall | lat=30.66 | long=104.06 | price=¥15 | content=Dan dan noodles.}}

==Sleep==
===Mid-range===
* {{sleep | name=Courtyard Inn | lat=30.65 | long=104.05 | checkin=14:00 | checkout=12:00 | price=¥450 per night | content=Quiet rooms.}}
===Splurge===
* {{sleep | name=Grand Hotel | lat=30.64 | long=104.04 | url=not-a-url | content=Spa and river views.}}
`;

describe("Wikivoyage listings", () => {
  const places = parseListings(WIKITEXT);
  const byName = (n: string) => places.find((p) => p.name === n)!;

  it("finds listings with categories from the template", () => {
    expect(places.map((p) => [p.category, p.name])).toEqual([
      ["see", "Not a section listing"],
      ["see", "Example Temple"],
      ["see", "Old Street"],
      ["eat", "Noodle Stall"],
      ["sleep", "Courtyard Inn"],
      ["sleep", "Grand Hotel"],
    ]);
  });

  it("reads coordinates and skips empty ones", () => {
    expect(byName("Example Temple")).toMatchObject({ lat: 30.67, lon: 104.07 });
    expect(byName("Old Street").lat).toBeUndefined();
  });

  it("cleans markup out of text fields", () => {
    const t = byName("Example Temple");
    expect(t.description).toBe("A Tang-dynasty temple with a teahouse. See photos.");
    expect(t.alt).toBe("示例寺");
    expect(t.directions).toBe("Metro Line 1, Example Stn");
    expect(t.url).toBe("https://example.org/temple");
    expect(t.group).toBe("Temples");
  });

  it("tags price tiers from headings and keeps check-in times", () => {
    expect(byName("Noodle Stall").tier).toBe("Budget");
    expect(byName("Courtyard Inn")).toMatchObject({ tier: "Mid-range", checkin: "14:00" });
    expect(byName("Grand Hotel").tier).toBe("Splurge");
  });

  it("rejects non-http urls", () => {
    expect(byName("Grand Hotel").url).toBeUndefined();
  });

  it("finds district articles and redirects", () => {
    const text = "==Districts==\n{{Regionlist|region1name=[[Beijing/Dongcheng|Dongcheng]]|region2name=[[Beijing/Xicheng]]}} and again [[Beijing/Dongcheng]]";
    expect(districtLinks(text, "Beijing")).toEqual(["Beijing/Dongcheng", "Beijing/Xicheng"]);
    expect(redirectTarget("#REDIRECT [[Xi'an]]")).toBe("Xi'an");
  });

  it("cleans links and entities", () => {
    expect(cleanText("[[A|B]] &amp; [[C]]&nbsp;x")).toBe("B & C x");
  });
});
