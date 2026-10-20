import { destinationSelect, nodeInspector, nodeTextInput } from './dom.ts';

export function updateNodeInspectorPosition() {
  // The widget now sits in the page layout under #output.
  // if (nodeInspector.hidden)
  //   return;
  // const drawerRect = drawer.getBoundingClientRect();
  // const mainRect = mainBox.getBoundingClientRect();
  // nodeInspector.style.width = '';
  // nodeInspector.style.left = drawerRect.right + 'px';
  // nodeInspector.style.top = mainRect.top + 'px';
}

export function setInspectorTextFocus() {
  nodeTextInput.focus();
  nodeTextInput.select();
}

export function setInspectorDestinationFocus() {
  destinationSelect.focus();
}

// visibility:hidden used to auto-blur focus; opacity+pointer-events dimming does not, so blur explicitly.
export function clearInspectorFocus() {
  const active = document.activeElement;
  const isFocusedElement = active instanceof HTMLElement;
  for (const el of isFocusedElement ? [active as HTMLElement] : []) {
    const isInsideInspector = nodeInspector.contains(el);
    if (isInsideInspector)
      el.blur();
  }
}
