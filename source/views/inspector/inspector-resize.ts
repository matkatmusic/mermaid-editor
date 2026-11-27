import { nodeInspector, outputBox } from '../../../dom.ts';

const MAX_SHARE_OF_VIEW_AREA = 0.5;
const nodeInspectorResizeHandle = document.getElementById('nodeInspectorResizeHandle')!;
let extraHeight = 0;

export function applyInspectorExtraHeight() {
  const sharedHeight = outputBox.getBoundingClientRect().height + nodeInspector.getBoundingClientRect().height;
  nodeInspector.style.height = '';
  const naturalHeight = nodeInspector.getBoundingClientRect().height;
  const maxExtraHeight = Math.max(0, sharedHeight * MAX_SHARE_OF_VIEW_AREA - naturalHeight);
  extraHeight = Math.min(extraHeight, maxExtraHeight);
  if (extraHeight > 0)
    nodeInspector.style.height = `${naturalHeight + extraHeight}px`;
}

function startInspectorResizeDrag(event: MouseEvent) {
  event.preventDefault();
  const startY = event.clientY;
  const startExtraHeight = extraHeight;
  function growInspectorWithMouse(moveEvent: MouseEvent) {
    extraHeight = Math.max(0, startExtraHeight + startY - moveEvent.clientY);
    applyInspectorExtraHeight();
  }
  function stopInspectorResizeDrag() {
    document.removeEventListener('mousemove', growInspectorWithMouse);
    document.removeEventListener('mouseup', stopInspectorResizeDrag);
  }
  document.addEventListener('mousemove', growInspectorWithMouse);
  document.addEventListener('mouseup', stopInspectorResizeDrag);
}
nodeInspectorResizeHandle.addEventListener('mousedown', startInspectorResizeDrag);
