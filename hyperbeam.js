/*
    * DEBUGGING *
*/

/**
 * @param {HTMLElement} elem 
 * @param {string} msg
 * @param {string} colour
 */
function visualDebug(elem, msg, colour="red") {
    const old_background = elem.style.backgroundColor;
    elem.style.backgroundColor = colour;
    console.log(msg);
    // breakpoint goes here
    elem.style.backgroundColor = old_background;
}

/*
    * HELPERS *
*/

/**
 * @template {(...args: any[]) => any} F
 */
class RunOnce {
    /**
     * @private
     * @type {F|null}
     */
    func;

    /**
     * @param {F} func 
     */
    constructor(func) {
        this.func = func;
    }

    /**
     * @param  {...Parameters<F>} args
     * @returns {ReturnType<F> | void}
     */
    runOnce(...args) {
        if (this.func !== null) {
            const func = this.func;
            this.func = null;
            return func(...args);
        }
    }

    /**
     * @return {boolean}
     */
    get hasRun() {
        return (this.func === null);
    }
}

/**
 * @template T
 */
class FutureCell {
    /**
     * @private
     * @type {((_: undefined) => void)[]}
     */
    requests = [];

    /**
     * @private
     * @type {T | undefined}
     */
    value = undefined;
    
    /**
     * @returns {Promise<T>}
     */
    async get() {
        if (this.value !== undefined) {
            return this.value;
        }
        await new Promise(resolve => {
            this.requests.push(resolve);
        });
        if (this.value === undefined) {
            throw new Error("FutureCell cannot store undefined");
        }
        return this.value;
    }

    /**
     * @returns {T|null}
     */
    tryGet() {
        return this.value ?? null;
    }
    
    /**
     * @returns {T}
     */
    expect(msg = "FutureCell value not present!") {
        if (this.value === undefined) {
            throw new Error(msg);
        }
        return this.value;
    }
    
    /**
     * @param {T} val 
     */
    set(val) {
        this.value = val;
        for (const resolve of this.requests) {
            resolve(undefined);
        }
        this.requests = [];
    }
}

/**
 * @template K
 * @template V
 */
class Mediator {
    /**
     * @private
     * @type {Object<K, FutureCell<V>>}
     */
    cells = {};
    
    /**
     * @param {K} key 
     * @returns {Promise<V>}
     */
    async get(key) {
        this.cells[key] ??= new FutureCell();
        return await this.cells[key].get();
    }

    /**
     * @param {K} key
     * @returns {V|null} 
     */
    tryGet(key) {
        this.cells[key] ??= new FutureCell();
        return this.cells[key].tryGet()
    }
    
    /**
     * @param {K} key 
     * @returns {V}
     */
    expect(key, msg = `Mediator value ${key} not present!`) {
        const cell = this.cells[key];
        if (cell === undefined) {
            throw new Error(msg);
        }
        return cell.expect(msg);
    }
    
    /**
     * @param {K} key 
     * @param {V} val 
     */
    set(key, val) {
        this.cells[key] ??= new FutureCell();
        this.cells[key].set(val);
    }
}

/*
    * COORDINATION *
*/

class FocusHandler {
    /**
     * @param {KeyboardEvent} event 
     */
    onKeyDown(event) {
        const _ = event;
    }

    /**
     * @param {KeyboardEvent} event 
     */
    onKeyUp(event) {
        const _ = event;
    }

    /**
     * @param {FocusEvent} event 
     */
    onFocus(event) {
        const _ = event;
    }

    /**
     * @param {FocusEvent} event 
     */
    onBlur(event) {
        const _ = event;
    }
}

class View {
    /**
     * @type {HTMLElement}
     */
    element;

    /**
     * @param {HTMLElement} elem 
     */
    constructor(elem) {
        this.element = elem;
    }

    /**
     * Removes the element from the dom, it can be placed back later.
     * 
     * @returns {View}
     */
    move() {
        this.element.remove();
        return this;
    }

    /**
     * @param {View} view 
     * @returns {View}
     */
    replaceWith(view) {
        this.element.insertAdjacentElement("afterend", view.element);
        return this.move();
    }

    /**
     * @param {FocusHandler} handler 
     */
    handleFocus(handler) {
        this.element.tabIndex = this.element.tabIndex; // Records tabIndex as manually set, thus making it part of the focus system.
        this.element.addEventListener('keydown', event => handler.onKeyDown(event));
        this.element.addEventListener('keyup', event => handler.onKeyUp(event));
        this.element.addEventListener('focus', event => handler.onFocus(event));
        this.element.addEventListener('blur', event => handler.onBlur(event));
    }

    focus() {
        this.element.focus()
    }

    /**
     * Removes the element from the dom and points to it via move-link hypertext.
     * 
     * @returns {string}
     */
    preserve() {
        return MoveLink.target(this.move().element);
    }

    show() {
        this.element.hidden = false;
    }

    hide() {
        this.element.hidden = true;
    }

    /**
     * Finds all elements in the document matching a css selector, where this has temporary id `this`.
     * 
     * @param {string} selector 
     * @returns {Array<View>}
     */
    selectAll(selector) {
        const old_id = this.element.id;
        this.element.id = "this";
        const selection = hyperbeam.selectAll(selector);
        this.element.id = old_id;
        return selection
    }

    /**
     * Finds the given element in the document matching selector, or `null` if not uniquely defined, where this has temporary id `this`.
     * 
     * @param {string} selector 
     * @returns {View | null}
     */
    select(selector) {
        const selection = this.selectAll(selector);
        if (selection.length != 1) {
            return null;
        }
        return selection[0];
    }

    /**
     * Finds the closest ancestor matching the selector.
     * 
     * @param {string} selector 
     * @returns {View | null}
     */
    ancestor(selector) {
        const elem = this.element.parentElement?.closest?.(selector);
        if (elem === null || elem === undefined) {
            return null;
        }
        if (!(elem instanceof HTMLElement)) {
            throw new Error(`Query ${JSON.stringify(selector)} selects non html elements!`);
        }
        return hyperbeam.getView(elem);
    }

    /**
     * @returns {View | null}
     */
    parent() {
        return this.ancestor("*");
    }

    /**
     * Checks if a css selector matches the item.
     * 
     * @param {string} selector
     * @returns {boolean} 
     */
    matches(selector) {
        return this.element.matches(selector);
    }

    *[Symbol.iterator]() {
        for (const elem of this.element.children) {
            yield hyperbeam.getView(/** @type {HTMLElement} */ (elem));
        }
    }

    /**
     * Appends the element as a child.
     * 
     * @param {View} view
     */
    append(view) {
        this.element.appendChild(view.element);
    }

    /**
     * Prepends the element as a child.
     * 
     * @param {View} view 
     */
    prepend(view) {
        this.element.prepend(view.element);
    }

    /**
     * @returns {string}
     */
    get hypertext() {
        return this.element.outerHTML;
    }

    /**
     * @param {string} txt 
     */
    set hypertext(txt) {
        this.element.outerHTML = txt;
    }
};

/**
 * A handler informing hyperbeam how to interact with a specific tag.
 * 
 * @template {HTMLElement} E
 * @typedef {Object} Handler
 * @property {(_: E) => (View)} getView
 * @property {(_: E) => Promise<void>} untilReady
 */

class FocusNavigator {
    /**
     * 
     * @param {HTMLElement} elem
     * @returns {boolean} 
     */
    supports(elem) {
        return false;
    }
}

const hyperbeam = {
    /**
     * @private
     * @type {Mediator<string, (root: ComponentRoot) => Component>}
     */
    componentFunctions: new Mediator(),

    /**
     * @private
     * @type {Object<string, Handler<any>>}
     */
    elementHandlers: {},

    /**
     * @private
     * @type {FutureCell<"started">}
     */
    started: new FutureCell(),

    /**
     * @private
     * @type {FocusNavigator}
     */
    navigator: new FocusNavigator(),

    /**
     * @type {Map<HTMLElement, HTMLElement | undefined>}
     */
    refocusPoints: new Map(),

    /**
     * @returns {View | null}
     */
    focused() {
        const elem = /** @type {HTMLElement | null} */ (document.querySelector("*:focus"));
        return /* if */ (elem === null)
            ? /* then */ null
            : /* else */ hyperbeam.getView(elem);
    },

    start() {
        console.log("starting hyperbeam");
        this.started.set("started");
    },

    /**
     * @returns {View}
     */
    placeholder() {
        const placeholder = document.createElement("null-placeholder");
        placeholder.hidden = true;
        return this.getView(placeholder);
    },

    /**
     * @param {string} htxt
     * @returns {View}
     */
    make(htxt) {
        const temp = this.placeholder();
        temp.element.innerHTML = htxt;
        const child = temp.element.firstElementChild;
        if (child === null) {
            throw new Error(`Could not make from hypertext: ${htxt}`);
        }
        // should be safe now
        return this.getView(/** @type {HTMLElement} */ (child));
    },

    /**
     * @param {View} v 
     * @param {View} w 
     */
    swap(v, w) {
        if (v === w) {
            return;
        }
        const temp = this.placeholder();
        v.replaceWith(temp);
        w.replaceWith(v);
        temp.replaceWith(w);
    },

    /**
     * Used to find the containing components root, skips components that `elem` is a field of.
     * 
     * @param {HTMLElement} elem
     * @returns {ComponentRoot|null}
     */
    getContainingComponentRoot(elem) {
        var ancestor = elem;
        var nesting = 0;
        while (ancestor !== document.body) {
            // cast is safe as we will not continue beyond the body element
            ancestor = /** @type {HTMLElement} */ (ancestor.parentElement);
            if (ancestor.tagName.toLowerCase() === "component-root") {
                if (nesting == 0) {
                    // tag is component-root, cast should be safe
                    return /** @type {ComponentRoot} */ (ancestor);
                }
                nesting -= 1;
            }
            if (ancestor.tagName.toLowerCase() === "component-field") {
                nesting += 1;
            }
        };
        return null;
    },

    /**
     * Support class for custom components.
     * 
     * @param {string} name 
     * @param {new (root: ComponentRoot) => Component} cls 
     */
    supportClass(name, cls) {
        this.supportFunction(name, root => new cls(root))
    },

    /**
     * Support function for custom components.
     * 
     * @param {string} name
     * @param {(root: ComponentRoot) => Component} f
     */
    supportFunction(name, f) {
        this.componentFunctions.set(name, f)
    },

    /**
     * Specify how hyperbeam should handle a given HTML tag.
     * 
     * @template {HTMLElement} E
     * @param {string} tag
     * @param {Handler<E>} handler
     */
    handleTag(tag, handler) {
        if (this.started.tryGet() === "started") {
            throw new Error("Cannot define new tags after hyperbeam start!");
        }
        this.elementHandlers[tag] = handler;
    },

    /**
     * Get the view for an HTML element.
     * 
     * @param {HTMLElement} elem
     * @returns {View}
     */
    getView(elem) {
        const tag = elem.tagName.toLowerCase();
        if (this.elementHandlers[tag]?.getView !== undefined) {
            return this.elementHandlers[tag].getView(elem);
        }
        return new View(elem);
    },

    /**
     * Await the initialisation of an HTML element.
     * 
     * *used for components to ensure the document is ready for programatic manipulation*
     * 
     * @param {HTMLElement} elem
     */
    async untilReady(elem) {
        const tag = elem.tagName.toLowerCase();
        if (this.elementHandlers[tag]?.untilReady !== undefined) {
            await this.elementHandlers[tag].untilReady(elem);
        }
    },


    /**
     * Finds all elements in the document matching a css selector.
     * 
     * @param {string} selector 
     * @returns {Array<View>}
     */
    selectAll(selector) {
        return [...document.querySelectorAll(selector)].map(elem => {
            if (!(elem instanceof HTMLElement)) {
                throw new Error(`Query ${JSON.stringify(selector)} selects non html elements!`);
            }
            return this.getView(elem)
        });
    },

    /**
     * Finds the given element matching selector, or `null` if not uniquely defined.
     * 
     * @param {string} selector
     * @retuns {View | null}
     */
    select(selector) {
        const matches = this.selectAll(selector);
        if (matches.length != 1) {
            return null;
        }
        return matches[0];
    }
};

class HorizontalFocusNavigator extends FocusNavigator {
    /**
     * @type {number}
     */
    bandTop;

    /**
     * @type {number}
     */
    bandBottom;

    /**
     * @type {number}
     */
    bandCenter;

    /**
     * @type {HTMLElement}
     */
    bandParent;

    /**
     * @param {HTMLElement} elem
     */
    constructor(elem) {
        super();
        this.bandTop = elem.offsetTop - elem.offsetHeight * 0.25;
        this.bandCenter = elem.offsetTop + elem.offsetHeight * 0.5;
        this.bandBottom = elem.offsetTop + elem.offsetHeight * 1.25;
        this.bandParent = elem.parentElement ?? (() => { throw new Error ("Cannot navigate outside of a parent") })();
    }

    /**
     * @param {HTMLElement} elem 
     * @returns {boolean}
     */
    supports(elem) {
        if (!this.bandParent.contains(elem)) {
            return false;
        }
        
        const elemTop = elem.offsetTop - elem.offsetHeight * 0.25;
        const elemCenter = elem.offsetTop + elem.offsetHeight * 0.5;
        const elemBottom = elem.offsetTop + elem.offsetHeight * 1.25;

        const linkTo = (this.bandTop < elemCenter) && (elemCenter < this.bandBottom);
        const linkFrom = (elemTop < this.bandCenter) && (this.bandCenter < elemBottom);

        return linkTo && linkFrom;
    }

    /**
     * @param {HTMLElement} elem 
     * @returns {HTMLElement | null}
     */
    right(elem) {
        if (!this.supports(elem)) {
            throw new Error("cannot navigate right from unsupported element")
        }
        const parent = elem.parentElement;
        if (parent === null) {
            return null;
        }
        const elemLeft = elem.offsetLeft;
        var closestLeft = Infinity;
        var closestSibling = null;
        for (const _sibling of parent.children) {
            const sibling = /** @type {HTMLElement} */ (_sibling);

            if (!this.supports(sibling)) {
                continue;
            }

            const siblingLeft = sibling.offsetLeft;
            if (siblingLeft <= elemLeft) {
                continue;
            }

            if (siblingLeft < closestLeft) {
                closestLeft = siblingLeft;
                closestSibling = sibling;
            }
        }
        return closestSibling;
    }

    /**
     * @param {HTMLElement} elem 
     * @returns {HTMLElement | null}
     */
    left(elem) {
        if (!this.supports(elem)) {
            throw new Error("cannot navigate left from unsupported element")
        }
        const parent = elem.parentElement;
        if (parent === null) {
            return null;
        }
        const elemLeft = elem.offsetLeft;
        var closestLeft = -Infinity;
        var closestSibling = null;
        for (const _sibling of parent.children) {
            const sibling = /** @type {HTMLElement} */ (_sibling);

            if (!this.supports(sibling)) {
                continue;
            }

            const siblingLeft = sibling.offsetLeft;
            if (siblingLeft >= elemLeft) {
                continue;
            }

            if (siblingLeft > closestLeft) {
                closestLeft = siblingLeft;
                closestSibling = sibling;
            }
        }
        return closestSibling;
    }
}

class VerticalFocusNavigator extends FocusNavigator {
    /**
     * @type {number}
     */
    bandLeft;

    /**
     * @type {number}
     */
    bandRight;

    /**
     * @type {number}
     */
    bandCenter;

    /**
     * @type {HTMLElement}
     */
    bandParent;

    /**
     * @param {HTMLElement} elem
     */
    constructor(elem) {
        super();
        this.bandLeft = elem.offsetLeft - elem.offsetWidth * 0.25;
        this.bandCenter = elem.offsetLeft + elem.offsetWidth * 0.5;
        this.bandRight = elem.offsetLeft + elem.offsetWidth * 1.25;
        this.bandParent = elem.parentElement ?? (() => { throw new Error ("Cannot navigate outside of a parent") })();
    }

    /**
     * @param {HTMLElement} elem 
     * @returns {boolean}
     */
    supports(elem) {
        if (!this.bandParent.contains(elem)) {
            return false;
        }

        const elemLeft = elem.offsetLeft - elem.offsetWidth * 0.25;
        const elemCenter = elem.offsetLeft + elem.offsetWidth * 0.5;
        const elemRight = elem.offsetLeft + elem.offsetWidth * 1.25;

        const linkTo = (this.bandLeft < elemCenter) && (elemCenter < this.bandRight);
        const linkFrom = (elemLeft < this.bandCenter) && (this.bandCenter < elemRight);

        return linkTo && linkFrom;
    }

    /**
     * @param {HTMLElement} elem 
     * @returns {HTMLElement | null}
     */
    down(elem) {
        if (!this.supports(elem)) {
            throw new Error("cannot navigate down from unsupported element")
        }
        const parent = elem.parentElement;
        if (parent === null) {
            return null;
        }
        const elemTop = elem.offsetTop;
        var closestTop = Infinity;
        var closestSibling = null;
        for (const _sibling of parent.children) {
            const sibling = /** @type {HTMLElement} */ (_sibling);

            if (!this.supports(sibling)) {
                continue;
            }

            const siblingTop = sibling.offsetTop;
            if (siblingTop <= elemTop) {
                continue;
            }

            if (siblingTop < closestTop) {
                closestTop = siblingTop;
                closestSibling = sibling;
            }
        }
        return closestSibling;
    }

    /**
     * @param {HTMLElement} elem 
     * @returns {HTMLElement | null}
     */
    up(elem) {
        if (!this.supports(elem)) {
            throw new Error("cannot navigate left from unsupported element")
        }
        const parent = elem.parentElement;
        if (parent === null) {
            return null;
        }
        const elemTop = elem.offsetTop;
        var closestTop = -Infinity;
        var closestSibling = null;
        for (const _sibling of parent.children) {
            const sibling = /** @type {HTMLElement} */ (_sibling);

            if (!this.supports(sibling)) {
                continue;
            }

            const siblingTop = sibling.offsetTop;
            if (siblingTop >= elemTop) {
                continue;
            }

            if (siblingTop > closestTop) {
                closestTop = siblingTop;
                closestSibling = sibling;
            }
        }
        return closestSibling;
    }
}

document.addEventListener("focus", event => {
    const focus = hyperbeam.focused();
    if (focus === null) {
        return;
    }
    if (!hyperbeam.navigator.supports(focus.element)) {
        hyperbeam.navigator = new FocusNavigator();
    }
});

document.addEventListener("keydown", event => {
    const focus = hyperbeam.focused();
    if (focus === null) {
        return;
    }

    if (event.key === "Escape") {
        const net = focus.ancestor("*[focus-net]");
        if (net === null) {
            return;
        }
        net.focus();
        hyperbeam.refocusPoints.set(net.element, focus.element);

    } if (event.key === "Enter") {
        if (focus.matches("*[focus-net]")) {
            const point = hyperbeam.refocusPoints.get(focus.element);
            if (point !== undefined) {
                point.focus();
                return;
            }

            for (const descendant of focus.selectAll("#this *")) {
                if (descendant.element.tabIndex >= 0) {
                    descendant.focus();
                    return;
                }
            }
        }
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        var _navigator = hyperbeam.navigator;
        if (!(_navigator instanceof HorizontalFocusNavigator) || !_navigator.supports(focus.element)) {
            if (focus.parent()?.element?.hasAttribute("arrow-nav")) {
                _navigator = new HorizontalFocusNavigator(focus.element);
            } else {
                return;
            }
        }
        hyperbeam.navigator = _navigator;
        const navigator = /** @type {HorizontalFocusNavigator} */ (_navigator);
        event.preventDefault();

        /**
         * @type {HTMLElement | null}
         */
        var elem = focus.element;
        while (elem != null) {
            if (event.key === "ArrowLeft") {
                elem = navigator.left(elem)
            } else if (event.key === "ArrowRight") {
                elem = navigator.right(elem)
            }

            if (elem === null) {
                break;
            }

            if (elem.tabIndex === 0) {
                elem.focus();
                // event.preventDefault();
                return;
            }
        }
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        var _navigator = hyperbeam.navigator;
        if (!(_navigator instanceof VerticalFocusNavigator) || !_navigator.supports(focus.element)) {
            if (focus.parent()?.element?.hasAttribute("arrow-nav")) {
                _navigator = new VerticalFocusNavigator(focus.element);
            } else {
                return;
            }
        }
        hyperbeam.navigator = _navigator;
        const navigator = /** @type {VerticalFocusNavigator} */ (_navigator);
        event.preventDefault();

        /**
         * @type {HTMLElement | null}
         */
        var elem = focus.element;
        while (elem != null) {
            if (event.key === "ArrowUp") {
                elem = navigator.up(elem)
            } else if (event.key === "ArrowDown") {
                elem = navigator.down(elem)
            }

            if (elem === null) {
                break;
            }

            if (elem.tabIndex === 0) {
                elem.focus();
                // event.preventDefault();
                return;
            }
        }
    }
});

/*
    * MOVEMENT HANDLING *
*/

/**
 * A hypertext placeholder tag.
 */
class NullPlaceholder extends HTMLElement {}

customElements.define(
    "null-placeholder",
    NullPlaceholder
);

/**
 * A hypertext tag that overrides itself to move an element when loaded.
 */
class MoveLink extends HTMLElement {
    static nextFree = 0;

    /**
     * @type {(number|HTMLElement)[]}
     */
    static elements = [];

    /**
     * @type {HTMLElement|null}
     */
    replacement = null;

    setup = new RunOnce(() => {
        const pos = Number(this.getAttribute("target"));
        const elem = MoveLink.elements[pos];
        if (typeof elem === "number") {
            throw new Error(`Element ${pos} not in MoveLink.elements!`)
        }
        MoveLink.elements[pos] = MoveLink.nextFree;
        MoveLink.nextFree = pos;
        this.replaceWith(elem);
        this.replacement = elem;
    });

    /**
     * Returns hypertext that, when inserted into the document, initiates a move.
     * 
     * @param {HTMLElement} elem 
     * @returns 
     */
    static target(elem) {
        const pos = MoveLink.nextFree;
        if (MoveLink.elements.length == MoveLink.nextFree) {
            MoveLink.nextFree += 1;
            MoveLink.elements.push(elem);
            return `<move-link hidden target="${pos}"></move-link>`;
        }
        if (typeof MoveLink.elements[pos] !== "number") {
            throw new Error("MoveLink static state corrupted!")
        }
        MoveLink.nextFree = MoveLink.elements[pos];
        MoveLink.elements[pos] = elem;
        return `<move-link hidden target="${pos}"></move-link>`;
    }
    
    connectedCallback() {
        this.setup.runOnce()
    }

    /**
     * @param {MoveLink} moveLink
     * @returns {View}
     */
    static getView(moveLink) {
        moveLink.setup.runOnce();
        if (moveLink.replacement === null) {
            throw new Error("MoveLink disconnected!");
        }
        return hyperbeam.getView(moveLink.replacement);
    }

    /**
     * @param {MoveLink} moveLink
     */
    static async untilReady(moveLink) {
        moveLink.setup.runOnce();
        if (moveLink.replacement !== null) {
            await hyperbeam.untilReady(moveLink.replacement);
        }
    }
};

customElements.define(
    "move-link",
    MoveLink
);

hyperbeam.handleTag(
    "move-link",
    MoveLink
);

/*
    * COMPONENT SYSTEM *
*/

/**
 * Assuming initialisation, access the containing component.
 * *for use in event handlers*
 * 
 * @param {HTMLElement} elem 
 * @returns {Component}
 */
function $(elem) {
    hyperbeam.started.expect("Hyperbeam not started!");

    const root = hyperbeam.getContainingComponentRoot(elem);
    if (root === null) {
        throw new Error(`Element ${elem} is not contained in a component!`);
    }
    return root.component.expect();
};

class Builder {
    /**
     * @type {Component}
     */
    component;

    /**
     * @param {Component} component the component being built
     */
    constructor(component) {
        this.component = component;
    }

    /**
     * Link a property to an attribute on the component root.
     * 
     * @param {string} name 
     * @param {"boolean"|"number"|"object"|"string"} type 
     */
    linkAttribute(name, type="string") {
        const component = this.component;
        switch (type) {
            default:
                throw new Error(`Type ${type} not supported as an attribute type!`);
            case "boolean":
                Object.defineProperty(this.component, name, {
                    /**
                     * @param {boolean} bool 
                     */
                    set(bool) {
                        if (bool) {
                            component.element.setAttribute(name, "");
                        } else {
                            component.element.removeAttribute(name);
                        }
                    },
                    /**
                     * @returns {boolean}
                     */
                    get() {
                        return component.element.hasAttribute(name);
                    }
                });
                break;
            case "number":
                Object.defineProperty(this.component, name, {
                    /**
                     * @param {number} num 
                     */
                    set(num) {
                        component.element.setAttribute(name, num.toString());
                    },
                    /**
                     * @returns {number}
                     */
                    get() {
                        return Number(component.element.getAttribute(name));
                    }
                });
                break;
            case "object":
                Object.defineProperty(this.component, name, {
                    /**
                     * @param {object} obj 
                     */
                    set(obj) {
                        component.element.setAttribute(name, JSON.stringify(obj));
                    },
                    /**
                     * @returns {object}
                     */
                    get() {
                        return JSON.parse(component.element.getAttribute(name) ?? "");
                    }
                });
                break;
            case "string":
                Object.defineProperty(this.component, name, {
                    /**
                     * @param {string} str 
                     */
                    set(str) {
                        component.element.setAttribute(name, str);
                    },
                    /**
                     * @returns {string}
                     */
                    get() {
                        return component.element.getAttribute(name) ?? "";
                    }
                })
                break;
        }
    }

    /**
     * Link a property to a field of the component and await the initialisation of its contents.
     * 
     * @param {string} name 
     */
    async linkElement(name) {
        const field = await this.component.element.componentFields.get(name);
        await hyperbeam.untilReady(field);
        Object.defineProperty(this.component, name, {
            /**
             * @param {View} view 
             */
            set(view) {
                if (view.element.contains(field)) {
                    throw new Error(`Cannot place HTML element ${view} inside of itself.`);
                } else {
                    field.replaceChildren(view.element);
                }
            },
            /**
             * @returns {View}
             */
            get() {
                // child of HTML element should also be an HTML element
                const child = /** @type {HTMLElement|null} */ (field.firstElementChild);
                if (child === null) {
                    const placeholder = document.createElement("null-placeholder");
                    placeholder.hidden = true;
                    field.appendChild(placeholder);
                    return hyperbeam.getView(placeholder);
                }
                return hyperbeam.getView(child);
            }
        });
    }
}

class Component extends View {
    /**
     * @type {ComponentRoot}
     */
    element;

    /**
     * @param {ComponentRoot} root 
     */
    constructor(root) {
        super(root)
        this.element = root;
    }

    /**
     * Finds all elements in the component matching a css selector, where this has temporary id `this`.
     * 
     * @param {string} query 
     * @returns {Array<View>}
     */
    selectAllInternal(query) {
        return this.selectAll(query).filter(elem => $(elem.element) === this);
    }

    /**
     * Finds the given element in the component matching selector, or `null` if not uniquely defined, where this has temporary id `this`.
     * 
     * @param {string} selector 
     * @returns {View | null}
     */
    selectInternal(selector) {
        const selection = this.selectAllInternal(selector);
        if (selection.length != 1) {
            return null;
        }
        return selection[0];
    }

    /**
     * Gets an element in the component by id.
     * 
     * @param {string} id 
     * @returns {View | null}
     */
    find(id) {
        return this.selectInternal(`#this *[id=${JSON.stringify(id)}]`);
    }

    /**
     * Initialise the component, linking to attributes and fields located in the document.
     * 
     * @param {Builder} builder
     * @returns {Promise<void>}
     */
    async onInit(builder) {
        const _ = builder
    }

    /**
     * Called once the component has been moved to a new location.
     */
    async onMove() {}
};

class ComponentRoot extends HTMLElement {
    /**
     * @type {FutureCell<Component>}
     */
    component = new FutureCell();

    /**
     * @type {Mediator<string, ComponentField>}
     */
    componentFields = new Mediator();

    setup = new RunOnce(async () => {
        await hyperbeam.started.get();
        const className = this.classList[0];
        const ctor = /* if */ (className === undefined)
            ? /* then */ /** @param {ComponentRoot} root */ root => new Component(root)
            : /* else */ await hyperbeam.componentFunctions.get(className);
        const component = ctor(this);
        await component.onInit(new Builder(component));
        this.component.set(component);
    });

    async connectedCallback() {
        const component = this.component.tryGet();
        if (component !== null) {
            component.onMove()
        } else {
            await this.setup.runOnce();
        }
    }

    /**
     * @param {ComponentRoot} root
     * @returns {View}
     */
    static getView(root) {
        return root.component.expect(`ComponentRoot ${root} not ready!`)
    }

    /**
     * @param {ComponentRoot} root
     */
    static async untilReady(root) {
        await root.setup.runOnce();
    }
};

customElements.define(
    "component-root",
    ComponentRoot
);

hyperbeam.handleTag(
    "component-root",
    ComponentRoot
);

class ComponentField extends HTMLElement {
    setup = new RunOnce(async () => {
        await hyperbeam.started.get();
        const root = hyperbeam.getContainingComponentRoot(this);
        if (root === null) {
            throw new Error(`ComponentField ${this} is not contained in a component!`);
        }
        const name = this.getAttribute("name");
        if (name !== null) {
            root.componentFields.set(name, this);
        }
        // styling info
        const rootClass = root.classList[0];
        if (rootClass !== undefined) {
            if (this.classList.contains(rootClass)) {
                const fieldClasses = this.getAttribute("class");
                if (fieldClasses === null) {
                    this.setAttribute("class", rootClass);
                } else {
                    this.setAttribute("class", `${rootClass} ${fieldClasses}`);
                }
            }
        }
    });
    
    async connectedCallback() {
        await this.setup.runOnce();
    }
};

customElements.define(
    "component-field",
    ComponentField
);