/** Width of the SVG the charts are drawn in; they scale to the card, so these are not pixels on screen. */
export const CHART_WIDTH = 420;

const CHAR_WIDTH = 5.4;
const BOX_PADDING = 8;
const LINE_HEIGHT = 12;
const GAP = 8;
const EDGE = 2;
const LABEL_GAP = 6;

/** A tooltip placed inside the chart: the box and where each line of text goes. */
export interface TooltipBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly lines: readonly { readonly text: string; readonly x: number; readonly y: number }[];
}

/**
 * Places a box with the lines of text above the point, centered on it and kept inside the chart; when
 * there is no room above, it goes below.
 * @example tooltipBox(210, 80, ['Jul 2025', 'R$ 955,34'], 190).y // 59
 */
export function tooltipBox(
  anchorX: number,
  anchorY: number,
  lines: readonly string[],
  chartHeight: number,
): TooltipBox {
  const width = Math.max(...lines.map((line) => line.length)) * CHAR_WIDTH + BOX_PADDING * 2;
  const height = lines.length * LINE_HEIGHT + BOX_PADDING;
  const x = Math.min(Math.max(anchorX - width / 2, EDGE), CHART_WIDTH - width - EDGE);
  const above = anchorY - height - GAP;
  const y = above >= EDGE ? above : Math.min(anchorY + GAP, chartHeight - height - EDGE);
  return {
    x,
    y,
    width,
    height,
    lines: lines.map((text, index) => ({
      text,
      x: x + BOX_PADDING,
      y: y + BOX_PADDING / 2 + LINE_HEIGHT * (index + 1) - 3,
    })),
  };
}

/**
 * How many labels to skip between the ones shown, so that they do not run into each other when there are
 * many months; 1 shows all of them.
 * @example labelStep(['jan. de 25', 'fev. de 25'], 364) // 1
 */
export function labelStep(
  labels: readonly string[],
  usableWidth: number,
  slotCount: number,
): number {
  const widest = Math.max(0, ...labels.map((label) => label.length)) * CHAR_WIDTH;
  const slot = usableWidth / Math.max(slotCount, 1);
  return Math.max(1, Math.ceil((widest + LABEL_GAP) / slot));
}
