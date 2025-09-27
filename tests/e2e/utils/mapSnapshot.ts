import { promises as fs } from 'fs';
import path from 'path';
import type { Page } from '@playwright/test';

/**
 * Shape of the serialised map snapshot written to disk.
 */
export interface MapSnapshot {
  /* All visualised nodes extracted from the DOM */
  nodes: Array<{
    /** Absolute path for the node (file/folder) */
    path: string | null;
    /** Bounding-box coordinates (viewport space) */
    x: number;
    y: number;
    width: number;
    height: number;
    /** CSS classes applied on the element – useful to assert aggregation/LvL-of-detail. */
    classes: string;
  }>;
  /** Current zoom scale of the stage (1 = 100 %) */
  scale: number;
  /** Sprite counts (if available via __metroDebug), providing additional rendering insight */
  spriteCounts?: {
    nodes: number;
    lines: number;
    badges: number;
    labels: number;
    total: number;
  };
  /** Timestamp (ms since epoch) when the snapshot was captured. */
  capturedAt: number;
}

/**
 * Captures the current map visualisation state *and* a full-page screenshot.
 * A JSON file (structural state) and PNG (visual reference) are written to
 * <project_root>/tests/e2e/snapshots.
 *
 * Usage inside a Playwright test:
 * ```ts
 * await captureMapSnapshot(page, 'after-zoom-in');
 * ```
 *
 * @param page Playwright page instance running Metro UI.
 * @param phase Readable identifier for the test phase (e.g., "initial-load").
 * @param outputDir Optional override for output directory.
 */
export async function captureMapSnapshot(
  page: Page,
  phase: string,
  outputDir = path.resolve(process.cwd(), 'tests', 'e2e', 'snapshots'),
  format: 'png' | 'jpeg' = 'png'
): Promise<{ pngPath: string; jsonPath: string }> {
  await fs.mkdir(outputDir, { recursive: true });
  const timestamp = Date.now();
  const fileBase = `${phase.replace(/\s+/g, '_')}-${timestamp}`;
  const imgExt = format === 'jpeg' ? 'jpg' : 'png';
  const pngPath = path.join(outputDir, `${fileBase}.${imgExt}`);
  const jsonPath = path.join(outputDir, `${fileBase}.json`);

  /* 1) Visual snapshot */
  await page.screenshot({ path: pngPath, fullPage: true, type: format });

  /* 2) Structural snapshot (JSON) */
  const structural: MapSnapshot = await page.evaluate(() => {
    const w = window as any;

    // Basic heuristic: try DOM [data-node-path] elements first
    const nodeElements = Array.from(
      document.querySelectorAll<HTMLElement>('[data-node-path]')
    );

    let nodes = nodeElements.map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        path: el.getAttribute('data-node-path'),
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        classes: el.className,
      } as const;
    });

    // Fallback: canvas-based render path (PIXI). Use __metroDebug.getNodes() if available.
    if ((!nodes || nodes.length === 0) && w.__metroDebug?.getNodes) {
      try {
        const dbgNodes = w.__metroDebug.getNodes();
        if (Array.isArray(dbgNodes) && dbgNodes.length > 0) {
          nodes = dbgNodes.map((n: any) => ({
            path: n?.path ?? null,
            x: Number.isFinite(n?.x) ? n.x : 0,
            y: Number.isFinite(n?.y) ? n.y : 0,
            // Synthetic size for analysis purposes; PIXI sprites don't expose DOM boxes
            width: 12,
            height: 12,
            classes: 'pixi-node',
          }));
        }
      } catch (e) {
        // ignore and keep nodes as-is
      }
    }

    // Prefer debug viewport scale when available; fallback to legacy hook or 1
    const scale =
      w.__metroDebug?.getViewport?.()?.scale ?? w.metroStage?.getScale?.() ?? 1;

    // Attempt to extract sprite counts via debug API if available
    const spriteCounts = w.__metroDebug?.getSpriteCounts?.();

    return {
      nodes,
      scale,
      spriteCounts: spriteCounts ?? undefined,
      capturedAt: Date.now(),
    } satisfies MapSnapshot;
  });

  await fs.writeFile(jsonPath, JSON.stringify(structural, null, 2), 'utf-8');

  return { pngPath, jsonPath };
}

/**
 * Performs a set of sanity checks validating whether the captured snapshot looks
 * healthy. The returned array contains a human-readable description for every
 * detected anomaly. An *empty* array indicates all tests passed.
 */
export function analyseSnapshot(snapshot: MapSnapshot): string[] {
  const issues: string[] = [];

  /* 1) Basic presence */
  if (snapshot.nodes.length === 0) {
    // If we have sprite information and it indicates drawing occurred, don't treat as fatal
    if (!snapshot.spriteCounts || snapshot.spriteCounts.total === 0) {
      issues.push('No nodes were rendered – visualisation might have failed.');
      return issues; // Further checks are pointless when nothing rendered.
    }
  }

  /* 2) Duplicate paths (should be unique) */
  const pathSet = new Set<string>();
  for (const n of snapshot.nodes) {
    if (!n.path) {
      issues.push('Encountered node element without data-node-path attribute.');
      continue;
    }
    if (pathSet.has(n.path)) {
      issues.push(`Duplicate node path detected: ${n.path}`);
    }
    pathSet.add(n.path);
  }

  /* 3) Bounding box sanity – negative coords usually mean off-screen */
  const offScreen = snapshot.nodes.filter((n) => n.x < 0 || n.y < 0);
  if (offScreen.length > 0) {
    issues.push(
      `${offScreen.length} node(s) positioned outside of viewport (negative coords).`
    );
  }

  /* 4) Extremely small or huge elements can indicate failed zoom/LOD */
  const tiny = snapshot.nodes.filter((n) => n.width < 4 || n.height < 4);
  const gigantic = snapshot.nodes.filter((n) => n.width > 4096 || n.height > 4096);
  if (tiny.length) {
    issues.push(`${tiny.length} node(s) rendered at extremely small size (<4px).`);
  }
  if (gigantic.length) {
    issues.push(
      `${gigantic.length} node(s) rendered at excessive size (>4096px) – likely layout error.`
    );
  }

  /* 5) Ensure non-node graphics (edges/labels) rendered when spriteCounts present */
  if (snapshot.spriteCounts) {
    const { total, nodes: nodeSprites } = snapshot.spriteCounts;
    if (total === 0) {
      issues.push('No sprites were rendered (total sprite count = 0).');
    } else if (total === nodeSprites) {
      issues.push('Only node sprites rendered – missing lines/labels/edges.');
    }
  }

  // Further domain-specific validations could be added here (e.g. LOD integrity,
  // aggregated group count, etc.)

  return issues;
}

/**
 * Convenience wrapper: loads a previously captured snapshot file (JSON) and
 * performs the analysis.
 */
export async function analyseSnapshotFile(jsonPath: string): Promise<string[]> {
  const raw = await fs.readFile(jsonPath, 'utf-8');
  const parsed = JSON.parse(raw) as MapSnapshot;
  return analyseSnapshot(parsed);
}
