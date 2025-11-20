/**
 * 0xminds Design Mode Script
 * This script enables visual editing of components in the iframe preview
 */

(function() {
  'use strict';

  // Global error handler - send errors to parent even if design mode crashes
  window.addEventListener('error', (event) => {
    try {
      window.parent.postMessage({
        type: '0x-design-mode:console-error',
        data: {
          message: event.message || 'Unknown error',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          timestamp: new Date().toISOString(),
          stack: event.error?.stack,
        },
      }, '*');
    } catch (e) {
      console.error('[0x-design-mode] Failed to send error to parent:', e);
    }
  }, true);

  // Wrap everything in try-catch
  try {

  // Design Mode state
  let isDesignModeActive = false;
  let selectedElement = null;
  let hoveredElement = null;
  let hoverTimeout = null;

  // Configuration
  const HIGHLIGHT_CLASS = 'oxdm-highlight';
  const SELECTED_CLASS = 'oxdm-selected';
  const HOVER_CLASS = 'oxdm-hover';
  const ACTIVE_CLASS = 'oxdm-active';
  const HOVER_THROTTLE_MS = 50; // Throttle hover events for better performance

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
      body.${ACTIVE_CLASS} * {
        user-select: none;
      }
    `;
    document.head.appendChild(style);
  }

  // Extract component data from element
  function extractComponentData(element) {
    // Get ONLY direct text content (not from children)
    // And check if element has child elements
    const getDirectTextContent = (el) => {
      let directText = '';
      let hasChildElements = false;

      for (let i = 0; i < el.childNodes.length; i++) {
        const node = el.childNodes[i];
        // Check if node is an ELEMENT_NODE (nodeType === 1)
        if (node.nodeType === 1) {
          hasChildElements = true;
        }
        // Only include TEXT_NODE (nodeType === 3)
        if (node.nodeType === 3) {
          directText += node.textContent;
        }
      }

      // If element has child elements, don't return any text
      // (it's a container, not a text element)
      return {
        text: hasChildElements ? '' : directText.trim(),
        hasChildElements: hasChildElements
      };
    };

    const textInfo = getDirectTextContent(element);

    const data = {
      componentId: element.getAttribute('data-0x-component-id'),
      componentName: element.getAttribute('data-0x-component'),
      file: element.getAttribute('data-0x-file'),
      line: element.getAttribute('data-0x-line'),
      column: element.getAttribute('data-0x-column'),
      tagName: element.tagName.toLowerCase(),
      className: element.className,
      textContent: textInfo.text,
      hasChildElements: textInfo.hasChildElements,
      computedStyles: {},
    };

    // Get computed styles
    const computedStyle = window.getComputedStyle(element);
    const stylesToExtract = [
      'color',
      'backgroundColor',
      'fontSize',
      'fontWeight',
      'fontFamily',
      'padding',
      'margin',
      'width',
      'height',
      'display',
      'flexDirection',
      'justifyContent',
      'alignItems',
      'textAlign',
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

  // Auto-tag counter for runtime elements
  let autoTagCounter = 10000;

  // Check if element is a tagged component
  function isTaggedComponent(element) {
    if (!element || !element.hasAttribute) return false;

    // Already tagged (by build or auto-tagged)
    return element.hasAttribute('data-0x-component-id');
  }

  // Check if element should be auto-tagged
  function shouldAutoTag(element) {
    // Skip if already tagged (by build or previously auto-tagged)
    if (element.hasAttribute('data-0x-component-id')) return false;
    if (element.hasAttribute('data-0x-auto-tagged')) return false;

    const tagName = element.tagName.toLowerCase();
    const textContent = element.textContent?.trim() || '';
    const childrenCount = element.children.length;

    // Only auto-tag elements with actual content
    if (!textContent && childrenCount === 0) return false;

    // Auto-tag semantic text elements
    const textElements = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'];
    if (textElements.includes(tagName) && textContent.length > 0) {
      return true;
    }

    // Auto-tag interactive elements
    const interactiveElements = ['button', 'a', 'input', 'textarea', 'select'];
    if (interactiveElements.includes(tagName)) {
      return true;
    }

    // Auto-tag small structural elements with text
    const smallElements = ['span', 'label', 'li'];
    if (smallElements.includes(tagName) && textContent.length > 0 && childrenCount < 3) {
      return true;
    }

    // Auto-tag divs/sections ONLY if they have:
    // - Direct text content (not just from children)
    // - OR exactly 1-3 children (small content blocks)
    if (tagName === 'div' || tagName === 'section' || tagName === 'article') {
      const hasDirectText = Array.from(element.childNodes).some(
        node => node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0
      );
      const smallContainer = childrenCount >= 1 && childrenCount <= 5;

      return hasDirectText || smallContainer;
    }

    return false;
  }

  // Auto-tag an element at runtime
  function autoTagElement(element) {
    const componentId = `auto-${autoTagCounter++}`;

    element.setAttribute('data-0x-component-id', componentId);
    element.setAttribute('data-0x-auto-tagged', 'true');
    element.setAttribute('data-0x-component', 'AutoTagged');
    element.setAttribute('data-0x-file', 'runtime-generated');
    element.setAttribute('data-0x-line', '0');
    element.setAttribute('data-0x-column', '0');
  }

  // Check if element is editable
  // Simple rule: If it's tagged (build or auto), it's editable!
  function isEditableElement(element) {
    if (!element) return false;

    const tagName = element.tagName.toLowerCase();

    // Skip only body and html
    if (tagName === 'html' || tagName === 'body') {
      return false;
    }

    // Skip #root container
    if (element.id === 'root') {
      return false;
    }

    // Skip "Made with 0xminds" link
    if (element.classList.contains('made-by-0xminds')) {
      return false;
    }

    // Skip children of "Made with 0xminds" link
    if (element.closest('.made-by-0xminds')) {
      return false;
    }

    // If element has data-0x-component-id, it's tagged and should be editable!
    // This includes both build-time tagged and auto-tagged elements
    return element.hasAttribute('data-0x-component-id');
  }

  // Find closest tagged and editable parent
  function findClosestTaggedElement(element) {
    let current = element;
    let attempts = 0;
    const maxAttempts = 10; // Prevent infinite loops

    while (current && current !== document.body && attempts < maxAttempts) {
      if (isTaggedComponent(current) && isEditableElement(current)) {
        return current;
      }
      current = current.parentElement;
      attempts++;
    }
    return null;
  }

  // Handle element hover with throttling for performance
  function handleMouseOver(event) {
    if (!isDesignModeActive) return;

    event.stopPropagation();

    // Throttle hover events
    if (hoverTimeout) return;

    hoverTimeout = setTimeout(() => {
      hoverTimeout = null;
    }, HOVER_THROTTLE_MS);

    const target = findClosestTaggedElement(event.target);

    // Log filtered elements for debugging
    if (!target && event.target !== hoveredElement) {
      const originalTarget = event.target.closest('[data-0x-component-id]');
      if (originalTarget && !isEditableElement(originalTarget)) {
        console.log('[0x-design-mode] Filtered non-editable element:', originalTarget.tagName);
      }
    }

    if (!target || target === hoveredElement) return;

    // Remove previous hover using requestAnimationFrame for better performance
    requestAnimationFrame(() => {
      if (hoveredElement && hoveredElement !== selectedElement) {
        hoveredElement.classList.remove(HOVER_CLASS);
      }

      hoveredElement = target;
      if (hoveredElement !== selectedElement) {
        hoveredElement.classList.add(HOVER_CLASS);
      }
    });
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

  // Mutation Observer to detect new elements
  let mutationObserver = null;

  function startMutationObserver() {
    if (mutationObserver) return;

    mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // Check for added nodes
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Auto-tag new elements if they should be tagged
            scanAndAutoTag(node);
          }
        });
      });
    });

    // Start observing
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.log('[0x-design-mode] MutationObserver started');
  }

  function stopMutationObserver() {
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
      console.log('[0x-design-mode] MutationObserver stopped');
    }
  }

  // Scan element and its children for auto-tagging
  function scanAndAutoTag(element) {
    // Check the element itself
    if (shouldAutoTag(element)) {
      autoTagElement(element);
    }

    // Check all descendants
    const descendants = element.querySelectorAll('*');
    descendants.forEach((descendant) => {
      if (shouldAutoTag(descendant)) {
        autoTagElement(descendant);
      }
    });
  }

  // Enable Design Mode
  function enableDesignMode() {
    if (isDesignModeActive) return;

    console.log('[0x-design-mode] Enabling Design Mode');
    isDesignModeActive = true;
    document.body.classList.add(ACTIVE_CLASS);

    // Inject styles
    injectStyles();

    // Start mutation observer to detect new elements
    startMutationObserver();

    // Scan existing elements for auto-tagging
    console.log('[0x-design-mode] Scanning existing elements...');
    scanAndAutoTag(document.body);

    // Add event listeners
    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('mouseleave', handleMouseLeave, true);

    // Notify parent
    window.parent.postMessage({
      type: '0x-design-mode:enabled',
    }, '*');
  }

  // Update element with new content/styles (optimized with RAF)
  function updateElement(updates) {
    const { componentId, textContent, styles } = updates;
    console.log('[0x-design-mode] updateElement called with:', updates);

    // Find element by component ID
    const element = document.querySelector(`[data-0x-component-id="${componentId}"]`);

    if (!element) {
      console.warn('[0x-design-mode] ❌ Element not found:', componentId);
      return;
    }

    console.log('[0x-design-mode] ✓ Element found:', element);

    // Use requestAnimationFrame for smooth updates
    requestAnimationFrame(() => {
      // Update text content
      if (textContent !== undefined && textContent !== null) {
        console.log('[0x-design-mode] Updating text to:', textContent);

        // Find all text nodes using TreeWalker
        const walker = document.createTreeWalker(
          element,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );

        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
          if (node.textContent.trim()) {
            textNodes.push(node);
          }
        }

        if (textNodes.length > 0) {
          console.log('[0x-design-mode] Found', textNodes.length, 'text nodes');
          textNodes[0].textContent = textContent;
          console.log('[0x-design-mode] ✓ Text updated');
        } else {
          // Check if element has child elements before setting textContent
          if (element.children.length === 0) {
            // No child elements, safe to set textContent directly
            console.log('[0x-design-mode] No child elements, setting text directly');
            element.textContent = textContent;
            console.log('[0x-design-mode] ✓ Text set directly');
          } else {
            console.warn('[0x-design-mode] ⚠️ Element has child elements, skipping text update to preserve children');
          }
        }
      }

      // Update styles (batch updates for better performance)
      if (styles) {
        console.log('[0x-design-mode] Updating styles:', styles);
        let styleCount = 0;

        // Apply all styles
        Object.entries(styles).forEach(([property, value]) => {
          // If value is empty, '0px', or reset value, remove the style property
          if (value === '' || value === '0px') {
            console.log('[0x-design-mode] Removing', property);
            element.style.removeProperty(property.replace(/([A-Z])/g, '-$1').toLowerCase());
            styleCount++;
          } else if (value && value !== 'rgb(0, 0, 0)') {
            // Apply non-empty, non-default values
            console.log('[0x-design-mode] Setting', property, '=', value);
            element.style[property] = value;
            styleCount++;
          }
        });

        console.log('[0x-design-mode] ✓', styleCount, 'styles applied/removed');
      }


      console.log('[0x-design-mode] ✅ Element updated successfully');
    });
  }

  // Disable Design Mode
  function disableDesignMode() {
    if (!isDesignModeActive) return;

    console.log('[0x-design-mode] Disabling Design Mode');
    isDesignModeActive = false;
    document.body.classList.remove(ACTIVE_CLASS);

    // Stop mutation observer
    stopMutationObserver();

    // Remove all highlights
    document.querySelectorAll(`.${HOVER_CLASS}, .${SELECTED_CLASS}, .${HIGHLIGHT_CLASS}`).forEach(el => {
      el.classList.remove(HOVER_CLASS, SELECTED_CLASS, HIGHLIGHT_CLASS);
    });

    // Remove event listeners
    document.removeEventListener('mouseover', handleMouseOver, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('mouseleave', handleMouseLeave, true);

    // Clear state and timers
    selectedElement = null;
    hoveredElement = null;
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }

    // Notify parent
    window.parent.postMessage({
      type: '0x-design-mode:disabled',
    }, '*');
  }

  // Listen for messages from parent window
  window.addEventListener('message', (event) => {
    // Log ALL messages for debugging
    console.log('[0x-design-mode] 📨 Message received from parent:', {
      type: event.data?.type,
      hasPayload: !!event.data?.payload,
      origin: event.origin,
      timestamp: new Date().toISOString()
    });

    // Security: In production, validate event.origin
    const { type, payload } = event.data;

    switch (type) {
      case '0x-design-mode:enable':
        console.log('[0x-design-mode] 🟢 Handling enable message');
        enableDesignMode();
        break;

      case '0x-design-mode:disable':
        console.log('[0x-design-mode] 🔴 Handling disable message');
        disableDesignMode();
        break;

      case '0x-design-mode:toggle':
        console.log('[0x-design-mode] 🔄 Handling toggle message');
        if (isDesignModeActive) {
          disableDesignMode();
        } else {
          enableDesignMode();
        }
        break;

      case '0x-design-mode:update-element':
        console.log('[0x-design-mode] 🎨 Handling update-element message');
        console.log('[0x-design-mode] Payload:', payload);
        if (payload) {
          console.log('[0x-design-mode] ✅ Calling updateElement with payload');
          updateElement(payload);
        } else {
          console.warn('[0x-design-mode] ❌ No payload in update-element message!');
        }
        break;

      default:
        // Ignore unknown messages (no log to avoid spam)
        break;
    }
  });

  // Capture console errors and send to parent (ALWAYS, not just in design mode)
  const originalConsoleError = console.error;
  console.error = function(...args) {
    // Call original console.error
    originalConsoleError.apply(console, args);

    // Always send error to parent
    const errorMessage = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');

    window.parent.postMessage({
      type: '0x-design-mode:console-error',
      data: {
        message: errorMessage,
        timestamp: new Date().toISOString(),
      },
    }, '*');
  };

  // Note: Global error handler is at the top of the file

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

  } catch (error) {
    console.error('[0x-design-mode] FATAL: Script initialization failed:', error);
    // Send error to parent
    try {
      window.parent.postMessage({
        type: '0x-design-mode:init-error',
        data: {
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
        },
      }, '*');
    } catch (e) {
      console.error('[0x-design-mode] Failed to send init error to parent:', e);
    }
  }

})();
