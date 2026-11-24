import { destinationInput, destinationList, destinationSelect } from './dom.ts';

let highlightedIndex = -1;

function closeDestinationList() {
  destinationList.hidden = true;
  destinationInput.setAttribute('aria-expanded', 'false');
  highlightedIndex = -1;
}

export function showDestinationInInput() {
  closeDestinationList();
  destinationInput.value = destinationSelect.selectedOptions[0]?.text ?? '';
}

function showDestinationOptionsMatching(query: string) {
  const lowerCaseQuery = query.toLowerCase();
  const items: HTMLElement[] = [];
  for (const option of destinationSelect.options) {
    // The option text holds the node text and the node id, so one test covers both.
    const isMatch = option.text.toLowerCase().includes(lowerCaseQuery);
    if (!isMatch)
      continue;
    const item = document.createElement('div');
    item.setAttribute('role', 'option');
    item.className = 'destination-option';
    item.dataset.value = option.value;
    item.textContent = option.text;
    items.push(item);
  }
  destinationList.replaceChildren(...items);
  highlightedIndex = -1;
  destinationList.hidden = false;
  destinationInput.setAttribute('aria-expanded', 'true');
}

function highlightDestinationItem(index: number) {
  const items = [...destinationList.children];
  highlightedIndex = Math.min(Math.max(index, 0), items.length - 1);
  items.forEach((item, itemIndex) => item.setAttribute('aria-selected', String(itemIndex === highlightedIndex)));
  items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
}

function pickDestination(value: string) {
  closeDestinationList();
  destinationSelect.value = value;
  destinationSelect.dispatchEvent(new Event('change', { bubbles: true }));
}

function openDestinationListOnClick() {
  if (!destinationList.hidden)
    return;
  destinationInput.select();
  showDestinationOptionsMatching('');
}

function filterDestinationListOnTyping() {
  showDestinationOptionsMatching(destinationInput.value);
}

function moveOrPickDestinationOnKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    showDestinationInInput();
    return;
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (destinationList.hidden)
      showDestinationOptionsMatching('');
    highlightDestinationItem(highlightedIndex + 1);
    return;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    highlightDestinationItem(highlightedIndex - 1);
    return;
  }
  if (event.key === 'Enter') {
    const item = destinationList.children[highlightedIndex] as HTMLElement | undefined;
    if (!item)
      return;
    event.preventDefault();
    pickDestination(item.dataset.value!);
  }
}

function pickDestinationOnItemClick(event: MouseEvent) {
  const item = (event.target as HTMLElement).closest<HTMLElement>('.destination-option');
  if (!item)
    return;
  pickDestination(item.dataset.value!);
}

function keepInputFocusOnListMouseDown(event: MouseEvent) {
  event.preventDefault();
}

function closeDestinationListOnOutsideMouseDown(event: MouseEvent) {
  if (destinationList.hidden)
    return;
  const isInsidePicker = (event.target as HTMLElement).closest('#destinationRow');
  if (isInsidePicker)
    return;
  showDestinationInInput();
}

destinationInput.addEventListener('click', openDestinationListOnClick);
destinationInput.addEventListener('input', filterDestinationListOnTyping);
destinationInput.addEventListener('keydown', moveOrPickDestinationOnKey);
destinationList.addEventListener('mousedown', keepInputFocusOnListMouseDown);
destinationList.addEventListener('click', pickDestinationOnItemClick);
document.addEventListener('mousedown', closeDestinationListOnOutsideMouseDown);
