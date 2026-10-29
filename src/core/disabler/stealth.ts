// src/core/disabler/stealth.ts
// Native function spoofing and property descriptor concealment.
// Prevents anti-cheat checks (like Naurok's kp()) from detecting monkey-patched APIs.
// @ts-nocheck

const origToString = Function.prototype.toString;
const nativeToStringMap = new WeakMap<Function, string>();

export function makeNative<T extends Function>(fn: T, name?: string): T {
    const fnName = name !== undefined ? name : (fn.name || '');
    nativeToStringMap.set(fn, `function ${fnName}() { [native code] }`);
    return fn;
}

export function definePrototypeGetter(proto: any, prop: string, getter: () => any, name?: string): void {
    try {
        const wrappedGetter = makeNative(getter, name || `get ${prop}`);
        Object.defineProperty(proto, prop, {
            get: wrappedGetter,
            configurable: true,
            enumerable: true
        });
    } catch (e) { /* ignore */ }
}

export function installStealthGuard(): void {
    // 1. Hook Function.prototype.toString so makeNative functions report native code
    try {
        Function.prototype.toString = function(this: any) {
            if (typeof this === 'function' && nativeToStringMap.has(this)) {
                return nativeToStringMap.get(this)!;
            }
            return origToString.apply(this, arguments as any);
        };
        makeNative(Function.prototype.toString, 'toString');
    } catch (e) { /* ignore */ }

    // 2. Hide spoofed properties on `document` from getOwnPropertyDescriptor(s)
    const HIDDEN_PROPS = new Set([
        'hidden',
        'visibilityState',
        'fullscreenElement',
        'webkitFullscreenElement',
        'mozFullScreenElement',
        'msFullscreenElement',
        'fullscreenEnabled',
        'webkitFullscreenEnabled',
        'mozFullScreenEnabled',
        'msFullscreenEnabled'
    ]);

    try {
        const origGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
        Object.getOwnPropertyDescriptor = makeNative(function(target: any, prop: PropertyKey) {
            if (target === document && typeof prop === 'string' && HIDDEN_PROPS.has(prop)) {
                return undefined;
            }
            return origGetOwnPropertyDescriptor.apply(this, arguments as any);
        }, 'getOwnPropertyDescriptor');
    } catch (e) { /* ignore */ }

    try {
        if (typeof Object.getOwnPropertyDescriptors === 'function') {
            const origGetOwnPropertyDescriptors = Object.getOwnPropertyDescriptors;
            Object.getOwnPropertyDescriptors = makeNative(function(target: any) {
                const descriptors = origGetOwnPropertyDescriptors.apply(this, arguments as any);
                if (target === document && descriptors) {
                    for (const prop of HIDDEN_PROPS) {
                        delete descriptors[prop];
                    }
                }
                return descriptors;
            }, 'getOwnPropertyDescriptors');
        }
    } catch (e) { /* ignore */ }

    try {
        const origHasOwnProperty = Object.prototype.hasOwnProperty;
        Object.prototype.hasOwnProperty = makeNative(function(this: any, prop: PropertyKey) {
            if (this === document && typeof prop === 'string' && HIDDEN_PROPS.has(prop)) {
                return false;
            }
            return origHasOwnProperty.apply(this, arguments as any);
        }, 'hasOwnProperty');
    } catch (e) { /* ignore */ }

    try {
        if (typeof Reflect !== 'undefined' && Reflect.getOwnPropertyDescriptor) {
            const origReflectGet = Reflect.getOwnPropertyDescriptor;
            Reflect.getOwnPropertyDescriptor = makeNative(function(target: any, prop: PropertyKey) {
                if (target === document && typeof prop === 'string' && HIDDEN_PROPS.has(prop)) {
                    return undefined;
                }
                return origReflectGet.apply(this, arguments as any);
            }, 'getOwnPropertyDescriptor');
        }
    } catch (e) { /* ignore */ }
}
