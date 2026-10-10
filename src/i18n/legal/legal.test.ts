import { describe, expect, it } from "vitest";
import { LOCALES } from "../locales";
import { LEGAL, LEGAL_SECTION_IDS, type LegalBlock } from ".";

const tags = (text: string) => [...text.matchAll(/<(\w+)>/g)].map((match) => match[1]).sort();
const texts = (block: LegalBlock): string[] =>
  block.kind === "list" ? block.items : block.kind === "table" ? [...block.head, ...block.rows.flat()] : [block.text];
const shape = (block: LegalBlock) =>
  block.kind === "list"
    ? `list:${block.items.length}`
    : block.kind === "table"
      ? `table:${block.head.length}x${block.rows.map((row) => row.length).join(",")}`
      : block.kind;

describe("legal page", () => {
  it("covers every section in order in every language", () => {
    for (const locale of LOCALES) {
      expect(LEGAL[locale].sections.map((section) => section.id), locale).toEqual([...LEGAL_SECTION_IDS]);
      expect(LEGAL[locale].updated, locale).toContain("{date}");
    }
  });

  it.each(LOCALES.filter((locale) => locale !== "en"))("%s matches the English structure and markup", (locale) => {
    LEGAL.en.sections.forEach((english, index) => {
      const section = LEGAL[locale].sections[index];
      expect(section.blocks.map(shape), section.id).toEqual(english.blocks.map(shape));
      section.blocks.forEach((block, blockIndex) => {
        const reference = texts(english.blocks[blockIndex]);
        texts(block).forEach((text, textIndex) => {
          expect(text.trim(), `${section.id} ${blockIndex}`).toBeTruthy();
          expect(tags(text), `${section.id} ${blockIndex}`).toEqual(tags(reference[textIndex]));
        });
      });
    });
  });
});
