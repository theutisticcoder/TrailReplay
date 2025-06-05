// Simple DOM utilities
export const qs = (selector) => document.querySelector(selector);
export const qsa = (selector) => document.querySelectorAll(selector);
export const byId = (id) => document.getElementById(id);

// Element creation helper
export const createElement = (tag, className = '', textContent = '') => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (textContent) element.textContent = textContent;
    return element;
};

// Show/hide utilities
export const show = (element) => {
    if (typeof element === 'string') element = qs(element);
    if (element) element.style.display = '';
};

export const hide = (element) => {
    if (typeof element === 'string') element = qs(element);
    if (element) element.style.display = 'none';
};

// Toggle visibility
export const toggle = (element, force) => {
    if (typeof element === 'string') element = qs(element);
    if (!element) return;
    
    if (force !== undefined) {
        element.style.display = force ? '' : 'none';
    } else {
        element.style.display = element.style.display === 'none' ? '' : 'none';
    }
}; 