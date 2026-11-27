import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { buildViewerBundle } from "../../source/app/server.ts";

test("test_buildViewerBundle_writes_viewer_js", () => {
    const viewerBundlePath = join(import.meta.dirname, "..", "..", "source", "app", "viewer.js");
    // Remove viewer.js so that an old copy cannot pass the test.
    rmSync(viewerBundlePath, { force: true });
    // Build the viewer bundle.
    buildViewerBundle();
    // Check that viewer.js exists.
    assert.ok(existsSync(viewerBundlePath));
});
