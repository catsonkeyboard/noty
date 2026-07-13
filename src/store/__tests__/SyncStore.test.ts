import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import { useSyncStore } from "@/store/SyncStore";
import { useSettingsStore } from "@/store/SettingsStore";

const summary = {
  uploaded: 1,
  downloaded: [],
  conflicts: [],
  deletedLocal: [],
  deletedRemote: 0,
  skippedDeletes: 0,
};

describe("SyncStore", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    useSettingsStore.setState({
      vaultPath: "/v",
      webdavUrl: "https://dav.example.com/dav/",
    });
    useSyncStore.setState({
      status: "idle",
      lastError: null,
      lastSyncAt: null,
      progress: null,
      lastConflicts: [],
      lastSkippedDeletes: 0,
    });
  });

  it("runs a sync and records success", async () => {
    vi.mocked(invoke).mockResolvedValue(summary);
    await useSyncStore.getState().syncNow();
    expect(invoke).toHaveBeenCalledWith("sync_now", { vault: "/v" });
    expect(useSyncStore.getState().status).toBe("success");
    expect(useSyncStore.getState().lastSyncAt).not.toBeNull();
  });

  it("records errors", async () => {
    vi.mocked(invoke).mockRejectedValue("boom");
    await useSyncStore.getState().syncNow();
    expect(useSyncStore.getState().status).toBe("error");
    expect(useSyncStore.getState().lastError).toContain("boom");
  });

  it("does nothing when webdav is not configured", async () => {
    useSettingsStore.setState({ webdavUrl: "" });
    await useSyncStore.getState().syncNow();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("refuses to start while already syncing", async () => {
    useSyncStore.setState({ status: "syncing" });
    await useSyncStore.getState().syncNow();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("records skipped deletes from the safety valve", async () => {
    vi.mocked(invoke).mockResolvedValue({ ...summary, skippedDeletes: 3 });
    await useSyncStore.getState().syncNow();
    expect(useSyncStore.getState().lastSkippedDeletes).toBe(3);
    expect(useSyncStore.getState().status).toBe("success");
  });

  it("claims the syncing slot synchronously to prevent re-entrancy", () => {
    vi.mocked(invoke).mockResolvedValue(summary);
    const first = useSyncStore.getState().syncNow();
    // before the first call resolves, the status is already "syncing"
    expect(useSyncStore.getState().status).toBe("syncing");
    const second = useSyncStore.getState().syncNow();
    return Promise.all([first, second]).then(() => {
      expect(vi.mocked(invoke).mock.calls.filter(([cmd]) => cmd === "sync_now")).toHaveLength(1);
    });
  });
});
