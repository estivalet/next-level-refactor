export type Point = { x: number; y: number };

/** Window position after dragging; clamping to the desktop happens in the reducer. */
export function dragTo(start: Point, pointerStart: Point, pointerNow: Point): Point {
  return { x: start.x + pointerNow.x - pointerStart.x, y: start.y + pointerNow.y - pointerStart.y };
}

/** Window size after resizing from the bottom-right corner; limits are applied in the reducer. */
export function resizeTo(
  startSize: { width: number; height: number },
  pointerStart: Point,
  pointerNow: Point,
): { width: number; height: number } {
  return {
    width: startSize.width + pointerNow.x - pointerStart.x,
    height: startSize.height + pointerNow.y - pointerStart.y,
  };
}
