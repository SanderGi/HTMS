'use strict';

export const old = Symbol('previous state');
export const element = Symbol('current element');
export const component = Symbol('parent web component');

export const jsvars = {};
const urlParams = new URLSearchParams(window.location.search);

/**
 * @param {Object} scope can be accessed from within the script as `this`. Everything else is not accessible except for global variables.
 * @param {string} script the JavaScript to be executed
 * @param {Object} args extra arguments to make available, keys are variable names and values are the corresponding values.
 * @returns {any} the result of the script
 */
const scopedEval = (scope, script, args = {}) =>
    Function('old', 'element', 'component', ...Object.keys(args), `"use strict"; ${script}`).bind(
        scope,
    )(old, element, component, ...Object.values(args));

class Signal {
    constructor(value) {
        this.value = value;
        this.listeners = new Set();
    }

    addListener(listener, elem_to_clean_up = undefined) {
        this.listeners.add(listener);
        if (elem_to_clean_up) {
            // each element should know how to cleanup its listeners
            if (!elem_to_clean_up.cleanup) {
                elem_to_clean_up.cleanup = [];
            }
            elem_to_clean_up.cleanup.push(() => this.removeListener(listener));
        }
    }

    removeListener(listener) {
        this.listeners.delete(listener);
    }

    emit() {
        for (const listener of this.listeners) {
            listener(this.value);
        }
    }
}

/**
 * Creates a child state that can be accessed from within the child element
 * and has access to the parent state without giving the parent or siblings
 * access to its state.
 * @param {Proxy} $parentstate the parent state
 * @returns {[Object, Proxy]} [childstate, $childState]
 */
function createStateSignals($parentstate) {
    const childState = { [old]: {} };
    const $childState = new Proxy(childState, {
        set(target, key, value) {
            if (key in $parentstate) {
                $parentstate[key] = value;
                return true;
            }
            if (!target[key]) {
                target[key] = new Signal();
            }
            target[old][key] = target[key].value;
            target[key].value = value;
            target[key].emit();
            return true;
        },
        get(target, key) {
            if ([old, element].includes(key)) {
                return target[key];
            }
            if (key in $parentstate) {
                return $parentstate[key];
            }
            if (!target[key]) {
                target[key] = new Signal();
            }
            return target[key].value;
        },
        has(target, key) {
            return key in $parentstate || key in target;
        },
    });
    return [childState, $childState];
}

/**
 * Sets a nested property on an object dynamically
 * @param {Object} obj the root object to access a nested property on
 * @param {string} key a sequence of '.' separated keys
 * @param {any} val the value to set
 * @param {boolean} append
 */
function setDeep(obj, key, val, append) {
    const subkeys = key.split('.');
    for (const subkey of subkeys.slice(0, -1)) {
        obj = obj[subkey];
    }
    if (append) obj[subkeys.at(-1)] += val;
    else obj[subkeys.at(-1)] = val;
}

function kebabToCamelCase(str) {
    return str.replace(/-./g, x => (x[1] == '-' ? '-' : x[1].toUpperCase()));
}

/**
 * Creates a function that sets the attribute/property on the element.
 * Handles special attributes like text := textContent.
 * @param {string} name the name of the attribute/property
 * @param {HTMLElement} elem the element to set the attribute on
 * @returns {(val: any) => void} a function that sets the attribute
 */
function createSetter(name, elem) {
    let append = false;
    if (name.endsWith('+')) {
        append = true;
        name = name.slice(0, -1);
    }
    if (name.startsWith(':')) {
        name = kebabToCamelCase(name.substring(1));
        if (name === 'text') name = 'textContent';
        if (name === 'html') name = 'innerHTML';
        return val => setDeep(elem, name, val, append);
    }
    if (append) return val => elem.setAttribute(name, elem.getAttribute(name) + val);
    return val => elem.setAttribute(name, val);
}

/**
 * Sets up an attribute on an element.
 * @param {HTMLElement} elem the element to setup
 * @param {HTMLAttributes} attr the attribute to setup
 * @param {Object} parentstate the parent state
 * @param {Object} state the current element state
 * @param {Proxy} $state the current element state proxy
 */
function setupAttribute(elem, attr, parentstate, state, $state) {
    if (attr.name.startsWith('@')) {
        const [rawEventName, ...rawArgs] = attr.name.slice(1).split('|');
        const args = rawArgs.reduce(
            (a, v) => ({ ...a, [v.split(':').at(0)]: v.split(':').at(1) || true }),
            {
                once: false,
                capture: false,
                passive: false,
                throttle: false,
                delay: false,
                fetch: false,
            },
        );
        const options = { capture: args.capture, once: args.once, passive: args.passive };
        const eventName = kebabToCamelCase(rawEventName);
        const eventHandler = args.fetch
            ? createFetchHandler(attr.value, $state, args.fetch === true ? undefined : args.fetch)
            : scopedEval($state, 'return ' + attr.value);
        const handlerWithDelay = args.delay
            ? e => setTimeout(() => eventHandler.call($state, e), args.delay)
            : e => eventHandler.call($state, e);
        if (!args.throttle) {
            elem.addEventListener(eventName, handlerWithDelay, options);
        } else {
            let pending = null;
            elem.addEventListener(
                eventName,
                e => {
                    pending = e;
                },
                options,
            );
            setInterval(() => {
                if (pending) handlerWithDelay(pending);
                pending = null;
            }, args.throttle);
        }
    } else if (attr.name.startsWith(':')) {
        const _setter = createSetter(attr.name.slice(1), elem);
        const isTemplateLiteral = /\$\{[^\}]+\}/.test(attr.value);
        let setter = _setter;
        if (isTemplateLiteral) {
            const dependencies = new Set();
            const $dependencyScraper = new Proxy($state, {
                get(target, key) {
                    const val = target[key];
                    if (!dependencies.has(key)) {
                        const s = parentstate[key] || state[key];
                        s.addListener(setter, elem);
                        dependencies.add(key);
                    }
                    return val;
                },
            });
            setter = val => _setter(scopedEval($dependencyScraper, 'return `' + attr.value + '`'));
        } else {
            const s = parentstate[attr.value] || state[attr.value];
            s.addListener(setter, elem);
        }
        setter($state[attr.value]);
    } else if (attr.name.startsWith('#let')) {
        const useURL = attr.name.startsWith('#let-url');
        const useLocalStorage = attr.name.startsWith('#let-local');
        const useSessionStorage = attr.name.startsWith('#let-session');

        const [varName, ...dependencies] = attr.name.split(':')[1].split('|');
        const casedVarName = kebabToCamelCase(varName);

        const value = useURL
            ? urlParams.get(casedVarName)
            : useLocalStorage
            ? localStorage.getItem(casedVarName)
            : useSessionStorage
            ? sessionStorage.getItem(casedVarName)
            : null;
        $state[casedVarName] = value ?? scopedEval($state, 'return ' + attr.value);

        for (const dependency of dependencies) {
            const s = parentstate[dependency] || state[dependency];
            s.addListener(() => {
                $state[casedVarName] = scopedEval($state, 'return ' + attr.value);
            }, elem);
        }

        const s = parentstate[casedVarName] || state[casedVarName];
        if (useURL) {
            s.addListener(val => {
                urlParams.set(casedVarName, val);
                window.history.replaceState(
                    {},
                    '',
                    `${location.pathname}?${urlParams}${location.hash}`,
                );
            }, elem);
        } else if (useLocalStorage) {
            s.addListener(val => {
                localStorage.setItem(casedVarName, val);
            }, elem);
        } else if (sessionStorage) {
            s.addListener(val => {
                sessionStorage.setItem(casedVarName, val);
            }, elem);
        }
    } else if (attr.name === '#jsvar') {
        jsvars[attr.value] = $state;
    }
}

/**
 * Creates an event handler for fetching
 * @param {string} query "fetch arguments -> target [-> subtarget]"
 * @param {Proxy} $state the relevant state object to make updates in relation to
 * @param {string} datatype one of 'text', 'json', 'formData', 'blob', 'arrayBuffer'
 * @returns
 */
function createFetchHandler(query, $state, datatype) {
    return async e => {
        const fetchargs = query.split('->', 1)[0];
        const res = await scopedEval($state, `return fetch(${fetchargs})`, { e: e });
        if (!res.ok) {
            console.error(
                `Failed to fetch(${fetchargs}), got status ${res.status} - ${res.statusText}: ${res.text}`,
            );
            return;
        }
        const target = query.replace(fetchargs, '').replace('->', '').trim();
        if (target === 'this') {
            for (const [key, val] of Object.entries(await res.json())) {
                $state[key] = val;
            }
            return;
        }
        if (target === 'console') {
            const content = await res[datatype ?? 'text']();
            console.log(content);
        } else if (target in $state) {
            const content = await res[datatype ?? 'text']();
            $state[target] = content;
        } else {
            insertAtTarget(target, await res.text());
        }
    };
}

/**
 * Inserts html/text at a specified location in the document.
 * @param {string} target identifies the element and way to insert, i.e. "[query selector] -> ['beforeBegin', 'afterBegin', 'beforeEnd', 'afterEnd', 'textContent', or 'outerHTML']"
 * @param {string} content the content to insert
 */
function insertAtTarget(target, content) {
    const [targetQuery, insertionPoint] = target.split('->', 2);
    if (insertionPoint === 'outerHTML') {
        document.querySelector(targetQuery.trim()).outerHTML = content;
    } else if (insertionPoint === 'textContent') {
        document.querySelector(targetQuery.trim()).textContent = content;
    } else if (insertionPoint) {
        document
            .querySelector(targetQuery.trim())
            .insertAdjacentHTML(insertionPoint.trim(), content);
    } else {
        document.querySelector(targetQuery.trim()).innerHTML = content;
    }
}

/**
 * Sets up a web component from a template.
 * @param {HTMLTemplateElement} elem the template element to setup
 * @param {Proxy} $state the template element state proxy
 */
function setupComponent(elem, $state) {
    const componentName = elem.attributes['#component'].value;
    const attributes = [...elem.attributes]
        .map(attr => attr.name)
        .filter(name => !['#', ':', '@'].includes(name[0]));
    class Component extends HTMLElement {
        static observedAttributes = attributes;

        constructor() {
            super();
            const shadow = this.attachShadow({ mode: 'open' });
            shadow.appendChild(elem.content.cloneNode(true));
            [this.state, this.$state] = createStateSignals({ [component]: this });
            this.state[element] = this;
            for (const attr of attributes) {
                const value = scopedEval($state, 'return ' + elem.attributes[attr].value);
                this.setAttribute(attr, value);
                this.$state[attr] = value;
            }
            for (const attr of elem.attributes) {
                setupAttribute(elem, attr, this.state, this.state, this.$state);
            }
            this.onConnectedScripts = [];
            this.onDisconnectedScripts = [];
            for (const child of shadow.children) {
                if (child.tagName === 'SCRIPT') {
                    if (child.hasAttribute('#onConnected')) {
                        this.onConnectedScripts.push(child.textContent);
                    } else if (child.hasAttribute('#onDisconnected')) {
                        this.onDisconnectedScripts.push(child.textContent);
                    } else {
                        scopedEval(this.$state, child.textContent);
                    }
                }
            }
        }
        connectedCallback() {
            setupChildren(this.shadowRoot, this.state, this.$state);
            mutationObserver.observe(this.shadowRoot, {
                childList: true,
                subtree: true,
            });
            for (const script of this.onConnectedScripts) {
                scopedEval(this.$state, script);
            }
        }
        disconnectedCallback() {
            for (const script of this.onDisconnectedScripts) {
                scopedEval(this.$state, script);
            }
            delete this.state;
            delete this.$state;
            undoSetup(this.shadowRoot);
        }
        attributeChangedCallback(name, oldValue, newValue) {
            this.$state[name] = newValue;
        }
    }
    window.customElements.define(componentName, Component);
}

/**
 * Loops through all children of an element and sets up event listeners and attribute setters.
 * @param {HTMLElement} elem the parent element
 * @param {Object} state the parent state
 * @param {Proxy} $state the parent state proxy
 */
function setupChildren(elem, state, $state) {
    for (const child of elem.children) {
        setup(child, state, $state);
    }
}

/**
 * Sets up event listeners and attribute setters for an element and its children.
 * @param {HTMLElement} elem the element to setup, recursively sets up all children
 * @param {Object} parentstate the parent state
 * @param {Object} state the child state
 * @param {Proxy} $state the child state proxy
 */
function setup(elem, parentstate = {}, $parentstate = {}) {
    const [state, $state] = createStateSignals($parentstate);
    elem.state = state;
    elem.$state = $state;
    state[element] = elem;

    if (elem.tagName === 'TEMPLATE' && elem.hasAttribute('#component')) {
        setupComponent(elem, $state);
        return;
    }

    for (const attr of elem.attributes) {
        setupAttribute(elem, attr, parentstate, state, $state);
    }
    setupChildren(elem, Object.assign({}, state, parentstate), $state);
}

// Link tags with #include attribute are fetched and inserted into the body.
for (const link of document.querySelectorAll('head link')) {
    if (link.hasAttribute('#include')) {
        fetch(link.attributes.href.value).then(res =>
            res.text().then(html => {
                insertAtTarget(link.getAttribute('#include') || 'body -> beforeEnd', html);
            }),
        );
    }
}

/**
 * Recursively undoes the setup of an element and all its children.
 * @param {HTMLElement} elem the element to undo setup on
 */
function undoSetup(elem) {
    for (const child of elem.children) {
        undoSetup(child);
    }
    for (const cleanup of elem.cleanup || []) {
        cleanup();
    }
    delete elem.state;
    delete elem.$state;
}

/**
 * Listen for DOM changes: setup new elements, undo setup on removed elements.
 */
const mutationObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
        for (const addedNode of mutation.addedNodes) {
            if (addedNode.nodeType !== Node.ELEMENT_NODE) {
                continue;
            }
            setup(addedNode, addedNode.parentElement.state, addedNode.parentElement.$state);
        }
        for (const removedNode of mutation.removedNodes) {
            if (removedNode.nodeType !== Node.ELEMENT_NODE) {
                continue;
            }
            undoSetup(removedNode);
        }
    }
});

// await setup to ensure everything is initialized when this module is imported
await new Promise(resolve => {
    document.addEventListener('DOMContentLoaded', () => {
        setup(document.body);
        resolve();
    });
});

mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
});
