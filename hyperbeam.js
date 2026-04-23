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
     * @param {View} view 
     * @returns {View}
     */
    replaceWith(view) {
        this.element.insertAdjacentElement("afterend", view.element);
        return this.move();
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
     * Removes the element from the dom, it can be placed back later.
     * 
     * @returns {View}
     */
    move() {
        this.element.remove();
        return this;
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
     * @returns {ComponentRoot|undefined}
     */
    getContainingComponentRoot(elem) {
        var ancestor = elem;
        var nesting = 0;
        while (ancestor !== document.body) {
            if (ancestor.tagName.toLowerCase() === "component-root") {
                if (nesting == 0) {
                    // tag is component-root, cast should be safe
                    return /** @type {ComponentRoot} */ (ancestor);
                }
                nesting -= 1;
            }
            // cast is safe as we will not continue beyond the body element
            ancestor = /** @type {HTMLElement} */ (ancestor.parentElement);
            if (ancestor.tagName.toLowerCase() === "component-field") {
                nesting += 1;
            }
        };
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
    }
};

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
    if (root === undefined) {
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
        if (root === undefined) {
            throw new Error(`ComponentField ${this} is not contained in a component!`);
        }
        const name = this.getAttribute("name");
        if (name !== null) {
            root.componentFields.set(name, this);
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