import { describe, expect, it } from "bun:test";
import { extractMentions } from "./rank";

describe("extractMentions", () => {
  it("extracts unique lowercase handles from captions, comments, and chats", () => {
    expect(extractMentions("hey @Alfred_1 and @maja.k check @alfred_1!")).toEqual([
      "alfred_1",
      "maja.k",
    ]);
  });

  it("ignores email addresses and single-char handles", () => {
    expect(extractMentions("email me at test@example.com or @a and @valid_user")).toEqual([
      "valid_user",
    ]);
  });
});