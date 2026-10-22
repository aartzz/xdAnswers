// src/providers/kahoot/dom/input.ts
// Kahoot answer input lookup for numeric and text answers.

// Kahoot uses data-functional-selector for answer inputs
// Numeric input has type="number" or type="text" inside the answer area
export function findInputElement(): HTMLInputElement | null {
    const el = document.querySelector('[data-functional-selector*="answer"] input[type="number"]')
           || document.querySelector('[data-functional-selector*="answer"] input[type="text"]')
           || document.querySelector('[data-functional-selector*="answer"] input')
           || document.querySelector('input[type="number"]')
           || document.querySelector('input[data-functional-selector*="answer"]')
           || document.querySelector('.numb-item input')
           || document.querySelector('input[data-testid="text-input"]')
           || document.querySelector('input[data-testid="pin-input"]');
    return el as HTMLInputElement | null;
}
