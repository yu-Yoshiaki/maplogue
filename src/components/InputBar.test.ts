import { describe, expect, it, vi } from "vitest";
import { attemptSubmit } from "./InputBar";
import type { OrganizeMode } from "../types/scene";

describe("attemptSubmit", () => {
  it("同一本文の再送では同じ id を維持する", async () => {
    const onSubmit = vi
      .fn<(id: string, text: string, mode: OrganizeMode) => Promise<void>>()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(undefined);

    const first = await attemptSubmit({
      pendingId: null,
      text: "hello",
      mode: "todo",
      onSubmit,
      createId: () => "in_fixedid0000001",
    });
    expect(first.ok).toBe(false);
    expect(first.pendingId).toBe("in_fixedid0000001");
    expect(first.text).toBe("hello");
    expect(onSubmit).toHaveBeenCalledWith("in_fixedid0000001", "hello", "todo");

    // 本文は変えず再送 → 同じ pendingId を渡す
    const second = await attemptSubmit({
      pendingId: first.pendingId,
      text: first.text,
      mode: "todo",
      onSubmit,
      createId: () => "in_should_not_use",
    });
    expect(second.ok).toBe(true);
    expect(second.pendingId).toBe(null);
    expect(second.text).toBe("");
    expect(onSubmit).toHaveBeenNthCalledWith(2, "in_fixedid0000001", "hello", "todo");
  });

  it("失敗後に本文を変更すると新規 id になる", async () => {
    const onSubmit = vi
      .fn<(id: string, text: string, mode: OrganizeMode) => Promise<void>>()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(undefined);

    const first = await attemptSubmit({
      pendingId: null,
      text: "hello",
      mode: "normal",
      onSubmit,
      createId: () => "in_oldpending00001",
    });
    expect(first.ok).toBe(false);
    expect(first.pendingId).toBe("in_oldpending00001");

    // onChange 相当: 本文変更で pendingId を null にする
    const pendingAfterEdit: string | null = null;

    const second = await attemptSubmit({
      pendingId: pendingAfterEdit,
      text: "hello edited",
      mode: "normal",
      onSubmit,
      createId: () => "in_newsubmit000001",
    });
    expect(second.ok).toBe(true);
    expect(second.id).toBe("in_newsubmit000001");
    expect(second.id).not.toBe(first.pendingId);
    expect(onSubmit).toHaveBeenNthCalledWith(2, "in_newsubmit000001", "hello edited", "normal");
  });

  it("成功時だけ pending id をクリアする", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const result = await attemptSubmit({
      pendingId: null,
      text: "ok",
      mode: "compare",
      onSubmit,
      createId: () => "in_success0000001",
    });
    expect(result).toEqual({
      pendingId: null,
      text: "",
      ok: true,
      id: "in_success0000001",
    });
    expect(onSubmit).toHaveBeenCalledWith("in_success0000001", "ok", "compare");
  });
});
