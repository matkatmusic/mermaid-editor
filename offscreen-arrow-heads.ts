import { diagramBox, outputBox } from './dom.ts';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
// The extra arrow tip sits this many pixels inside the visible area, so the whole head shows.
const EDGE_INSET_PX = 2;
// ponytail: fixed sampling along the line, then a bisection; a line that leaves and re-enters the view between two samples can be missed.
const SAMPLE_COUNT = 100;
const REFINE_STEPS = 20;
// A short step ahead on the line is enough to read its direction.
const DIRECTION_LENGTH = 2;

interface ScreenArea {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

function getVisibleArea(insetPx: number): ScreenArea {
    const outputRect = outputBox.getBoundingClientRect();
    const left = outputRect.left + outputBox.clientLeft + insetPx;
    const top = outputRect.top + outputBox.clientTop + insetPx;
    return { left, top, right: left + outputBox.clientWidth - 2 * insetPx, bottom: top + outputBox.clientHeight - 2 * insetPx };
}

function isPointInArea(point: DOMPoint, area: ScreenArea) {
    if (point.x < area.left)
        return false;
    if (point.x > area.right)
        return false;
    if (point.y < area.top)
        return false;
    if (point.y > area.bottom)
        return false;
    return true;
}

function doesRectOverlapArea(rect: DOMRect, area: ScreenArea) {
    if (rect.right < area.left)
        return false;
    if (rect.left > area.right)
        return false;
    if (rect.bottom < area.top)
        return false;
    if (rect.top > area.bottom)
        return false;
    return true;
}

function getScreenPointAtLength(path: SVGPathElement, length: number, matrix: DOMMatrix) {
    return path.getPointAtLength(length).matrixTransform(matrix);
}

// Walks the line from its source; returns the length of the last point inside the area, or null when no point is inside.
function findLastVisibleLength(path: SVGPathElement, totalLength: number, matrix: DOMMatrix, area: ScreenArea) {
    let lastInsideLength = -1;
    for (let step = 0; step <= SAMPLE_COUNT; step++) {
        const length = totalLength * step / SAMPLE_COUNT;
        const isInside = isPointInArea(getScreenPointAtLength(path, length, matrix), area);
        if (isInside)
            lastInsideLength = length;
    }
    if (lastInsideLength < 0)
        return null;
    let insideLength = lastInsideLength;
    let outsideLength = Math.min(totalLength, lastInsideLength + totalLength / SAMPLE_COUNT);
    for (let step = 0; step < REFINE_STEPS; step++) {
        const middleLength = (insideLength + outsideLength) / 2;
        const isInside = isPointInArea(getScreenPointAtLength(path, middleLength, matrix), area);
        if (isInside)
            insideLength = middleLength;
        else
            outsideLength = middleLength;
    }
    return insideLength;
}

// Same shape and style as the marker the line uses for its normal arrow head; the tip lands on the point.
function buildArrowHead(path: SVGPathElement, length: number, marker: SVGMarkerElement) {
    const point = path.getPointAtLength(length);
    const pointAhead = path.getPointAtLength(Math.min(length + DIRECTION_LENGTH, path.getTotalLength()));
    const angleDegrees = Math.atan2(pointAhead.y - point.y, pointAhead.x - point.x) * 180 / Math.PI;
    const markerPath = marker.querySelector('path')!;
    const viewBox = marker.viewBox.baseVal;
    const scale = Math.min(marker.markerWidth.baseVal.value / viewBox.width, marker.markerHeight.baseVal.value / viewBox.height);
    const head = document.createElementNS(SVG_NAMESPACE, 'path');
    head.setAttribute('d', markerPath.getAttribute('d')!);
    head.setAttribute('class', 'arrowMarkerPath offscreen-arrow-head');
    head.setAttribute('style', markerPath.getAttribute('style') ?? '');
    const markerPathStyle = getComputedStyle(markerPath);
    head.style.fill = markerPathStyle.fill;
    head.style.stroke = markerPathStyle.stroke;
    head.setAttribute('transform', `translate(${point.x} ${point.y}) rotate(${angleDegrees}) scale(${scale}) translate(${-marker.refX.baseVal.value} ${-marker.refY.baseVal.value})`);
    head.setAttribute('pointer-events', 'none');
    head.setAttribute('data-edge-id', path.getAttribute('data-id')!);
    return head;
}

// A line whose end point is off screen gets one extra arrow head at the last visible point of the line.
export function updateOffscreenArrowHeads() {
    for (const oldHead of diagramBox.querySelectorAll('.offscreen-arrow-head'))
        oldHead.remove();
    const visibleArea = getVisibleArea(0);
    const insetArea = getVisibleArea(EDGE_INSET_PX);
    for (const path of diagramBox.querySelectorAll<SVGPathElement>('path.flowchart-link')) {
        const markerEnd = path.getAttribute('marker-end');
        if (markerEnd === null)
            continue;
        if (!doesRectOverlapArea(path.getBoundingClientRect(), visibleArea))
            continue;
        const matrix = path.getScreenCTM()!;
        const totalLength = path.getTotalLength();
        const endPoint = getScreenPointAtLength(path, totalLength, matrix);
        if (isPointInArea(endPoint, visibleArea))
            continue;
        const lastVisibleLength = findLastVisibleLength(path, totalLength, matrix, insetArea);
        if (lastVisibleLength === null)
            continue;
        const markerId = markerEnd.match(/#([^)"']+)/)![1];
        const marker = diagramBox.querySelector(`#${CSS.escape(markerId)}`) as SVGMarkerElement;
        path.after(buildArrowHead(path, lastVisibleLength, marker));
    }
}

outputBox.addEventListener('scroll', updateOffscreenArrowHeads);
window.addEventListener('resize', updateOffscreenArrowHeads);
