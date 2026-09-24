import { describe, expect, it } from "vitest";
import { CsvParser, parseCsv, rowToObject } from "../csv";

describe("CsvParser", () => {
  it("parses simple rows with CRLF and LF endings", () => {
    expect(parseCsv("a,b,c\r\n1,2,3\n4,5,6")).toEqual([["a", "b", "c"], ["1", "2", "3"], ["4", "5", "6"]]);
  });

  it("strips a UTF-8 BOM from the first chunk only", () => {
    expect(parseCsv("﻿x,y\n1,2")).toEqual([["x", "y"], ["1", "2"]]);
  });

  it("handles quoted fields with delimiters, newlines and doubled quotes", () => {
    const text = 'name,note\n"Acme, Inc.","line1\nline2"\n"He said ""hi""",plain';
    expect(parseCsv(text)).toEqual([
      ["name", "note"],
      ["Acme, Inc.", "line1\nline2"],
      ['He said "hi"', "plain"],
    ]);
  });

  it("keeps empty trailing fields and skips blank lines", () => {
    expect(parseCsv("a,b,c\n1,,\n\n2,3,\n")).toEqual([["a", "b", "c"], ["1", "", ""], ["2", "3", ""]]);
  });

  it("is chunk-boundary safe, including a doubled quote split across chunks", () => {
    const text = 'a,b\n"x""y",2\n"p,q","r\ns"\n3,4\n';
    const whole = parseCsv(text);
    for (let cut = 1; cut < text.length; cut++) {
      const p = new CsvParser();
      const out = [...p.push(text.slice(0, cut)), ...p.push(text.slice(cut)), ...p.end()];
      expect(out, `cut at ${cut}`).toEqual(whole);
    }
  });

  it("supports alternative delimiters", () => {
    expect(parseCsv("a;b\n1;2", { delimiter: ";" })).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("keeps a mid-field quote literally (Excel style)", () => {
    expect(parseCsv('a,b\n5\' 10" tall,x')).toEqual([["a", "b"], ['5\' 10" tall', "x"]]);
  });

  it("rowToObject tolerates short and long records", () => {
    expect(rowToObject(["a", "b"], ["1"])).toEqual({ a: "1", b: "" });
    expect(rowToObject(["a"], ["1", "2"])).toEqual({ a: "1" });
  });
});
