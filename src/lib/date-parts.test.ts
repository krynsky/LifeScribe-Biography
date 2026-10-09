import { describe, it, expect } from "vitest";
import { dateToParts, partsToDate } from "./date-parts";

describe("partsToDate", () => {
  it("derives precision from which parts are filled", () => {
    expect(partsToDate({ year: "2017", month: "", day: "" })).toEqual({ date: "2017-01-01", precision: "year" });
    expect(partsToDate({ year: "2017", month: "2", day: "" })).toEqual({ date: "2017-02-01", precision: "month" });
    expect(partsToDate({ year: "2017", month: "2", day: "14" })).toEqual({ date: "2017-02-14", precision: "day" });
  });

  it("ignores a day without a month", () => {
    expect(partsToDate({ year: "2017", month: "", day: "9" })).toEqual({ date: "2017-01-01", precision: "year" });
  });

  it("rejects empty or impossible dates", () => {
    expect(partsToDate({ year: "", month: "", day: "" }).date).toBeNull();
    expect(partsToDate({ year: "abc", month: "", day: "" }).date).toBeNull();
    expect(partsToDate({ year: "2017", month: "2", day: "30" }).date).toBeNull();
    expect(partsToDate({ year: "2017", month: "13", day: "" }).date).toBeNull();
  });

  it("accepts Feb 29 only in leap years", () => {
    expect(partsToDate({ year: "2020", month: "2", day: "29" }).date).toBe("2020-02-29");
    expect(partsToDate({ year: "2021", month: "2", day: "29" }).date).toBeNull();
  });
});

describe("dateToParts", () => {
  it("round-trips stored dates, blanking parts below the precision", () => {
    expect(dateToParts("2017-02-14T00:00:00.000Z", "day")).toEqual({ year: "2017", month: "2", day: "14" });
    expect(dateToParts("2017-02-01", "month")).toEqual({ year: "2017", month: "2", day: "" });
    expect(dateToParts("2017-01-01", "year")).toEqual({ year: "2017", month: "", day: "" });
    expect(dateToParts(null, "day")).toEqual({ year: "", month: "", day: "" });
  });
});
