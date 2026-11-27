import { diagramBox, outputBox } from '../../../dom.ts';
import { getNodeId } from '../../../render-helpers.ts';
import { HEXAGON_PADDING_HEIGHT, HEXAGON_POINTS_WIDTH_RATIO, NODE_PADDING_HEIGHT, NODE_PADDING_WIDTH } from '../../model/node-size.ts';
import { setNodeSize } from './editor-node-size.ts';

// ponytail: every mouse move tests the shape of every block and decision; a diagram with thousands of nodes needs a spatial index.
const GRAB_MARGIN_PX = 6;
const HEXAGON_POINT_COUNT = 6;

interface Grab {
    nodeEl: Element;
    shape: SVGGraphicsElement;
    id: string;
    isHexagon: boolean;
    left: boolean;
    right: boolean;
    top: boolean;
    bottom: boolean;
}

let isResizing = false;
let shouldSkipNextClick = false;

function isBlockOrChoiceId(id: string) {
    const isBlock = id.startsWith('B_');
    const isChoice = id.startsWith('Q_CHOICE_');
    return isBlock || isChoice;
}

function isDecisionId(id: string) {
    const isQuestion = id.startsWith('Q_');
    const isChoice = id.startsWith('Q_CHOICE_');
    return isQuestion && !isChoice;
}

// Block and choice: a band of GRAB_MARGIN_PX on both sides of the box outline.
function findRectangleGrabAt(x: number, y: number, nodeEl: Element, id: string): Grab | null {
    const shape = nodeEl.querySelector('rect');
    if (!shape)
        return null;
    const box = shape.getBoundingClientRect();
    if (x < box.left - GRAB_MARGIN_PX)
        return null;
    if (x > box.right + GRAB_MARGIN_PX)
        return null;
    if (y < box.top - GRAB_MARGIN_PX)
        return null;
    if (y > box.bottom + GRAB_MARGIN_PX)
        return null;
    const left = Math.abs(x - box.left) <= GRAB_MARGIN_PX;
    const right = Math.abs(x - box.right) <= GRAB_MARGIN_PX;
    const top = Math.abs(y - box.top) <= GRAB_MARGIN_PX;
    const bottom = Math.abs(y - box.bottom) <= GRAB_MARGIN_PX;
    const isNearOutline = left || right || top || bottom;
    if (!isNearOutline)
        return null;
    return { nodeEl, shape, id, isHexagon: false, left, right, top, bottom };
}

// Hexagon decision: only the flat top edge, the flat bottom edge, the left point and the right point. A diamond has no grab place.
function findHexagonGrabAt(x: number, y: number, nodeEl: Element, id: string): Grab | null {
    const shape = nodeEl.querySelector('polygon');
    if (!shape)
        return null;
    if (shape.points.numberOfItems !== HEXAGON_POINT_COUNT)
        return null;
    const matrix = shape.getScreenCTM()!;
    const points = [...shape.points].map((point) => new DOMPoint(point.x, point.y).matrixTransform(matrix));
    const boxLeft = Math.min(...points.map((point) => point.x));
    const boxRight = Math.max(...points.map((point) => point.x));
    const boxTop = Math.min(...points.map((point) => point.y));
    const boxBottom = Math.max(...points.map((point) => point.y));
    const middleY = (boxTop + boxBottom) / 2;
    const topEdgeXs = points.filter((point) => Math.abs(point.y - boxTop) < 1).map((point) => point.x);
    const isOverFlatEdge = x >= Math.min(...topEdgeXs) && x <= Math.max(...topEdgeXs);
    const isNearMiddleHeight = Math.abs(y - middleY) <= 2 * GRAB_MARGIN_PX;
    const grab = { nodeEl, shape, id, isHexagon: true, left: false, right: false, top: false, bottom: false };
    if (isOverFlatEdge) {
        if (Math.abs(y - boxTop) <= GRAB_MARGIN_PX)
            return { ...grab, top: true };
        if (Math.abs(y - boxBottom) <= GRAB_MARGIN_PX)
            return { ...grab, bottom: true };
    }
    if (isNearMiddleHeight) {
        if (Math.abs(x - boxLeft) <= GRAB_MARGIN_PX)
            return { ...grab, left: true };
        if (Math.abs(x - boxRight) <= GRAB_MARGIN_PX)
            return { ...grab, right: true };
    }
    return null;
}

function findGrabAt(x: number, y: number): Grab | null {
    for (const nodeEl of diagramBox.querySelectorAll('g.node')) {
        const id = getNodeId(nodeEl);
        let grab: Grab | null = null;
        if (isBlockOrChoiceId(id))
            grab = findRectangleGrabAt(x, y, nodeEl, id);
        if (isDecisionId(id))
            grab = findHexagonGrabAt(x, y, nodeEl, id);
        if (grab)
            return grab;
    }
    return null;
}

function getResizeCursor(grab: Grab) {
    const isOnVerticalSide = grab.left || grab.right;
    const isOnHorizontalSide = grab.top || grab.bottom;
    if (!isOnHorizontalSide)
        return 'ew-resize';
    if (!isOnVerticalSide)
        return 'ns-resize';
    const isOnFallingDiagonal = (grab.left && grab.top) || (grab.right && grab.bottom);
    return isOnFallingDiagonal ? 'nwse-resize' : 'nesw-resize';
}

// The text area of the render wrapper at its smallest, in px at 100% zoom: 25 "0" characters wide and 2 text rows high.
function measureMinimumTextArea(nodeEl: Element, pixelsPerUnit: number) {
    const label = nodeEl.querySelector('.nodeLabel')!;
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;width:25ch;height:2lh';
    label.appendChild(probe);
    const probeBox = probe.getBoundingClientRect();
    probe.remove();
    return { width: probeBox.width / pixelsPerUnit, height: probeBox.height / pixelsPerUnit };
}

// Rule: a drag of the grabbed side by d px (at 100% zoom) adds d to that dimension. The opposite side stays fixed in the outline;
// after the release the layout centres the node again, so the node may shift.
function followResizeDrag(startEvent: MouseEvent, grab: Grab) {
    const startBox = grab.shape.getBoundingClientRect();
    const startSize = grab.shape.getBBox();
    const pixelsPerUnit = startBox.width / startSize.width;
    const minimumText = measureMinimumTextArea(grab.nodeEl, pixelsPerUnit);
    const minimumHeight = minimumText.height + (grab.isHexagon ? HEXAGON_PADDING_HEIGHT : NODE_PADDING_HEIGHT);
    // The two points of a hexagon add width in proportion to its height, so its smallest width depends on its height.
    function getMinimumWidth(height: number) {
        if (grab.isHexagon)
            return minimumText.width + NODE_PADDING_WIDTH + HEXAGON_POINTS_WIDTH_RATIO * height;
        return minimumText.width + NODE_PADDING_WIDTH;
    }
    // A shape drawn smaller than the minimum snaps to the minimum in both dimensions, as the render does for any size line.
    let newHeight = Math.max(minimumHeight, startSize.height);
    let newWidth = Math.max(getMinimumWidth(newHeight), startSize.width);
    let hasMoved = false;
    const outline = document.createElement('div');
    outline.id = 'nodeResizeOutline';
    outline.style.cssText = 'position:fixed;box-sizing:border-box;border:2px dashed #1a73e8;pointer-events:none;z-index:1000';
    document.body.appendChild(outline);
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    isResizing = true;

    function drawOutline() {
        const widthPx = newWidth * pixelsPerUnit;
        const heightPx = newHeight * pixelsPerUnit;
        outline.style.width = widthPx + 'px';
        outline.style.height = heightPx + 'px';
        outline.style.left = (grab.left ? startBox.right - widthPx : startBox.left) + 'px';
        outline.style.top = (grab.top ? startBox.bottom - heightPx : startBox.top) + 'px';
    }
    function moveResize(event: MouseEvent) {
        const movedX = (event.clientX - startEvent.clientX) / pixelsPerUnit;
        const movedY = (event.clientY - startEvent.clientY) / pixelsPerUnit;
        hasMoved = true;
        if (grab.bottom)
            newHeight = Math.max(minimumHeight, startSize.height + movedY);
        if (grab.top)
            newHeight = Math.max(minimumHeight, startSize.height - movedY);
        if (grab.right)
            newWidth = Math.max(getMinimumWidth(newHeight), startSize.width + movedX);
        if (grab.left)
            newWidth = Math.max(getMinimumWidth(newHeight), startSize.width - movedX);
        drawOutline();
    }
    function endResize() {
        document.removeEventListener('mousemove', moveResize);
        outline.remove();
        document.body.style.userSelect = previousUserSelect;
        isResizing = false;
        if (!hasMoved)
            return;
        shouldSkipNextClick = true;
        setNodeSize(grab.id, Math.round(newWidth), Math.round(newHeight));
    }
    drawOutline();
    document.addEventListener('mousemove', moveResize);
    document.addEventListener('mouseup', endResize, { once: true });
}

function showResizeCursor(event: MouseEvent) {
    if (isResizing)
        return;
    const grab = findGrabAt(event.clientX, event.clientY);
    outputBox.style.cursor = grab ? getResizeCursor(grab) : '';
}

function startResizeOnMouseDown(event: MouseEvent) {
    shouldSkipNextClick = false;
    if (event.button !== 0)
        return;
    if (event.shiftKey)
        return;
    if (event.metaKey)
        return;
    if (event.ctrlKey)
        return;
    const grab = findGrabAt(event.clientX, event.clientY);
    if (!grab)
        return;
    followResizeDrag(event, grab);
}

// The click after a resize must not select the node and re-render over the new size.
function skipClickAfterResize(event: MouseEvent) {
    if (!shouldSkipNextClick)
        return;
    shouldSkipNextClick = false;
    event.stopPropagation();
}

outputBox.addEventListener('mousemove', showResizeCursor);
outputBox.addEventListener('mousedown', startResizeOnMouseDown);
outputBox.addEventListener('click', skipClickAfterResize, true);
