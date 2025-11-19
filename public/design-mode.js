/**
 * 0xminds Design Mode Script
 * This script enables visual editing of components in the iframe preview
 */

(function() {
  'use strict';

  // Design Mode state
  let isDesignModeActive = false;
  let selectedElement = null;
  let hoveredElement = null;

  // Configuration
  const HIGHLIGHT_CLASS = '0x-design-mode-highlight';
  const SELECTED_CLASS = '0x-design-mode-selected';
  const HOVER_CLASS = '0x-design-mode-hover';

  // Inject styles for visual feedback
  function injectStyles() {
    const styleId = '0x-design-mode-styles';

    // Remove existing styles if present
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) {
      existingStyle.remove();
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Design Mode - Hover State */
      .${HOVER_CLASS} {
        outline: 2px dashed #3b82f6 !important;
        outline-offset: 2px !important;
        cursor: pointer !important;
        position: relative !important;
      }

      /* Design Mode - Selected State */
      .${SELECTED_CLASS} {
        outline: 3px solid #8b5cf6 !important;
        outline-offset: 2px !important;
        position: relative !important;
      }

      /* Design Mode - Active Indicator */
      .${HIGHLIGHT_CLASS} {
        box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2) inset !important;
      }

      /* Design Mode - Component Badge */
      .${HOVER_CLASS}::before {
        content: attr(data-0x-component);
        position: absolute;
        top: -24px;
        left: 0;
        background: #3b82f6;
        color: white;
        font-size: 11px;
        font-family: monospace;
        padding: 2px 6px;
        border-radius: 3px;
        z-index: 10000;
        pointer-events: none;
        white-space: nowrap;
      }

      /* Disable pointer events on text nodes when in design mode */
      body.0x-design-mode-active * {
        user-select: none;
      }
    `;
    document.head.appendChild(style);
  }

  // Extract component data from element
  function extractComponentData(element) {
    const data = {
      componentId: element.getAttribute('data-0x-component-id'),
      componentName: element.getAttribute('data-0x-component'),
      file: element.getAttribute('data-0x-file'),
      line: element.getAttribute('data-0x-line'),
      column: element.getAttribute('data-0x-column'),
      tagName: element.tagName.toLowerCase(),
      className: element.className,
      textContent: element.textContent?.trim().substring(0, 100) || '',
      computedStyles: {},
    };

    // Get computed styles
    const computedStyle = window.getComputedStyle(element);
    const stylesToExtract = [
      'color',
      'backgroundColor',
      'fontSize',
      'fontWeight',
      'padding',
      'margin',
      'width',
      'height',
      'display',
      'flexDirection',
      'justifyContent',
      'alignItems',
      'borderRadius',
      'border',
      'gap',
    ];

    stylesToExtract.forEach(prop => {
      data.computedStyles[prop] = computedStyle.getPropertyValue(
        prop.replace(/([A-Z])/g, '-$1').toLowerCase()
      );
    });

    // Get Tailwind classes
    data.tailwindClasses = element.className.split(/\s+/).filter(cls => cls.length > 0);

    return data;
  }

  // Check if element is a tagged component
  function isTaggedComponent(element) {
    return element && element.hasAttribute && element.hasAttribute('data-0x-component-id');
  }

  // Find closest tagged parent
  function findClosestTaggedElement(element) {
    let current = element;
    while (current && current !== document.body) {
      if (isTaggedComponent(current)) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  // Handle element hover
  function handleMouseOver(event) {
    if (!isDesignModeActive) return;

    event.stopPropagation();

    const target = findClosestTaggedElement(event.target);
    if (!target || target === hoveredElement) return;

    // Remove previous hover
    if (hoveredElement && hoveredElement !== selectedElement) {
      hoveredElement.classList.remove(HOVER_CLASS);
    }

    hoveredElement = target;
    if (hoveredElement !== selectedElement) {
      hoveredElement.classList.add(HOVER_CLASS);
    }
  }

  // Handle element click
  function handleClick(event) {
    if (!isDesignModeActive) return;

    event.preventDefault();
    event.stopPropagation();

    const target = findClosestTaggedElement(event.target);
    if (!target) return;

    // Remove previous selection
    if (selectedElement) {
      selectedElement.classList.remove(SELECTED_CLASS);
    }

    // Set new selection
    selectedElement = target;
    selectedElement.classList.add(SELECTED_CLASS);
    selectedElement.classList.remove(HOVER_CLASS);

    // Extract and send component data to parent
    const componentData = extractComponentData(target);

    window.parent.postMessage({
      type: '0x-design-mode:element-selected',
      data: componentData,
    }, '*');

    console.log('[0x-design-mode] Element selected:', componentData);
  }

  // Handle mouse leave
  function handleMouseLeave(event) {
    if (!isDesignModeActive) return;

    const target = findClosestTaggedElement(event.target);
    if (target && target === hoveredElement && target !== selectedElement) {
      hoveredElement.classList.remove(HOVER_CLASS);
      hoveredElement = null;
    }
  }

  // Enable Design Mode
  function enableDesignMode() {
    if (isDesignModeActive) return;

    console.log('[0x-design-mode] Enabling Design Mode');
    isDesignModeActive = true;
    document.body.classList.add('0x-design-mode-active');

    // Inject styles
    injectStyles();

    // Add event listeners
    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('mouseleave', handleMouseLeave, true);

    // Notify parent
    window.parent.postMessage({
      type: '0x-design-mode:enabled',
    }, '*');
  }

  // Disable Design Mode
  function disableDesignMode() {
    if (!isDesignModeActive) return;

    console.log('[0x-design-mode] Disabling Design Mode');
    isDesignModeActive = false;
    document.body.classList.remove('0x-design-mode-active');

    // Remove all highlights
    document.querySelectorAll(`.${HOVER_CLASS}, .${SELECTED_CLASS}, .${HIGHLIGHT_CLASS}`).forEach(el => {
      el.classList.remove(HOVER_CLASS, SELECTED_CLASS, HIGHLIGHT_CLASS);
    });

    // Remove event listeners
    document.removeEventListener('mouseover', handleMouseOver, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('mouseleave', handleMouseLeave, true);

    // Clear state
    selectedElement = null;
    hoveredElement = null;

    // Notify parent
    window.parent.postMessage({
      type: '0x-design-mode:disabled',
    }, '*');
  }

  // Listen for messages from parent window
  window.addEventListener('message', (event) => {
    // Security: In production, validate event.origin
    const { type, payload } = event.data;

    switch (type) {
      case '0x-design-mode:enable':
        enableDesignMode();
        break;

      case '0x-design-mode:disable':
        disableDesignMode();
        break;

      case '0x-design-mode:toggle':
        if (isDesignModeActive) {
          disableDesignMode();
        } else {
          enableDesignMode();
        }
        break;

      case '0x-design-mode:update-element':
        // Future: Handle style updates from parent
        if (payload && selectedElement) {
          console.log('[0x-design-mode] Update element:', payload);
          // This will be implemented when we add the edit panel
        }
        break;

      default:
        // Ignore unknown messages
        break;
    }
  });

  // Send ready message to parent
  window.addEventListener('load', () => {
    window.parent.postMessage({
      type: '0x-design-mode:ready',
    }, '*');
    console.log('[0x-design-mode] Script loaded and ready');
  });

  // Expose API for debugging
  window.__0xDesignMode = {
    enable: enableDesignMode,
    disable: disableDesignMode,
    isActive: () => isDesignModeActive,
    getSelected: () => selectedElement,
    extractData: extractComponentData,
  };

})();
