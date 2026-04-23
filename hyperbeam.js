/*
    * HELPERS *
*/

class RunOnce {
    func = null;

    constructor(func) {
        this.func = func;
    }

    // public:

    runOnce(...args) {
        if (this.func !== null) {
            const func = this.func;
            this.func = null;
            return func(...args);
        }
    }
}

class FutureCell {
    requests = [];
    value = undefined;
    
    // public:
    
    async get() {
        if (this.value !== undefined) {
            return this.value;
        }
        await new Promise(resolve => {
            this.requests.push(resolve);
        });
        return this.value;
    }
    
    expect() {
        if (this.value === undefined) {
            throw new Error("FutureCell value not present!");
        }
        return this.value;
    }
    
    set(val) {
        this.value = val;
        for (const resolve of this.requests) {
            resolve();
        }
        this.requests = null;
    }
}

class Mediator {
    cells = {};

    // public:
    
    async get(key) {
        this.cells[key] ??= new FutureCell();
        return await this.cells[key].get();
    }
    
    expect(key) {
        const cell = this.cells[key];
        if (cell === undefined) {
            return undefined;
        }
        return cell.expect();
    }
    
    set(key, val) {
        this.cells[key] ??= new FutureCell();
        this.cells[key].set(val);
    }
}

/*
    * FORWARD DEFINITIONS *
*/

let View = null;

let Builder = null;
let Component = null;
let ComponentRoot = null;
let ComponentField = null;

/*
    * COORDINATION *
*/

View = class {
    element = null;

    constructor(elem) {
        this.element = elem;
    }

    // public:

    show() {
        this.element.hidden = false;
    }

    hide() {
        this.element.hidden = true;
    }

    move() {
        this.element.remove();
        return this;
    }

    get hypertext() {
        return this.element.outerHTML;
    }

    set hypertext(txt) {
        this.element.outerHTML = txt;
    }
};

const hyperbeam = {
    componentClasses: new Mediator(),
    elementHandlers: {},

    // public:

    getContainingComponentRoot(elem) {
        var ancestor = elem;
        var nesting = 0;
        while (ancestor !== document.body) {
            if (ancestor.tagName.toLowerCase() === "component-root") {
                if (nesting == 0) {
                    return ancestor;
                }
                nesting -= 1;
            }
            ancestor = ancestor.parentElement;
            if (ancestor.tagName.toLowerCase() === "component-field") {
                nesting += 1;
            }
        };
    },

    supportClass(name, cls) {
        this.componentClasses.set(name, cls);
    },

    handleTag(tag, handler) {
        this.elementHandlers[tag] = handler;
    },

    getView(elem) {
        const tag = elem.tagName.toLowerCase();
        if (this.elementHandlers[tag]?.getView !== undefined) {
            return this.elementHandlers[tag].getView(elem);
        }
        return new View(elem);
    },

    async untilReady(elem) {
        if (elem === null) {
            return;
        }
        const tag = elem.tagName.toLowerCase();
        if (this.elementHandlers[tag]?.untilReady !== undefined) {
            await this.elementHandlers[tag].untilReady(elem);
        }
    }
};

/*
    * MOVEMENT HANDLING *
*/

MoveLink = class extends HTMLElement {
    // slab data structure for tracking
    static nextFree = 0;
    static elements = [];

    // public:

    static target(elem) {
        const pos = PlaceElement.nextFree;

        if (MoveLink.elements.length == MoveLink.nextFree) {
            MoveLink.nextFree += 1;
            MoveLink.elements.push(elem);
            return `<move-link hidden target="${pos}"></move-link>`;
        }

        MoveLink.nextFree = MoveLink.elements[pos];
        MoveLink.elements[pos] = elem;
        return `<move-link hidden target="${pos}"></move-link>`;
    }
    
    constructor() {
        super();

        const pos = this.getAttribute("target");
        const elem = MoveLink.elements[pos];
        if (typeof elem === "number") {
            throw new Error(`Element ${pos} not in MoveLink.elements!`)
        }
        MoveLink.elements[pos] = MoveLink.nextFree;
        MoveLink.nextFree = pos;

        this.replaceWith(elem);
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

function $(elem) {
    const root = hyperbeam.getContainingComponentRoot(elem);
    if (root === undefined) {
        throw new Error(`Element ${elem} is not contained in a component!`);
    }
    return root.component.expect();
};

Builder = class {
    constructor(component) {
        this.component = component;
    }

    linkAttribute(name, type="string") {
        switch (type) {
            default:
                throw new Error(`Type ${type} not supported as an attribute type!`);
            case "boolean":
                Object.defineProperty(this.component, name, {
                    set(bool) {
                        if (bool) {
                            this.component.element.setAttribute(name, "");
                        } else {
                            this.component.element.removeAttribute(name);
                        }
                    },
                    get() {
                        return this.component.element.hasAttribute(name);
                    }
                });
                break;
            case "number":
                Object.defineProperty(this.component, name, {
                    set(num) {
                        this.component.element.setAttribute(name, num.toString());
                    },
                    get() {
                        return Number(this.component.element.getAttribute(name));
                    }
                });
                break;
            case "object":
                Object.defineProperty(this.component, name, {
                    set(obj) {
                        this.component.element.setAttribute(name, JSON.stringify(obj));
                    },
                    get() {
                        return JSON.parse(this.component.element.getAttribute(name));
                    }
                });
                break;
            case "string":
                Object.defineProperty(this.component, name, {
                    set(str) {
                        this.component.element.setAttribute(name, str);
                    },
                    get() {
                        return this.component.element.getAttribute(name);
                    }
                })
                break;
        }
    }

    async linkElement(name) {
        const field = await this.component.element.componentFields.get(name);
        await hyperbeam.untilReady(field);
        Object.defineProperty(this.component, name, {
            set(view) {
                if (view.element.contains(field)) {
                    throw new Error(`Cannot place HTML element ${view} inside of itself.`);
                } else {
                    field.replaceChildren(view.element);
                }
            },
            get() {
                if (field.firstElementChild === undefined) {
                    return null;
                } else {
                    return hyperbeam.getView(field.firstElementChild);
                }
            }
        });
    }
}

Component = class extends View {
    async init(builder) {}
};

ComponentRoot = class extends HTMLDivElement {
    component = new FutureCell();
    componentFields = new Mediator();
    setup = new RunOnce(async () => {
        const className = this.classList[0];
        const cls = /* if */ (className === undefined)
            ? /* then */ Component
            : /* else */ await hyperbeam.componentClasses.get(className);
        const component = new cls(this);
        await component.init(new Builder(component));
        this.component.set(component);
    });
    
    async connectedCallback() {
        await this.setup.runOnce();
    }
};

customElements.define(
    "component-root",
    ComponentRoot,
    { extends: "div" }
);

hyperbeam.handleTag(
    "component-root",
    ComponentRoot
);

ComponentField = class extends HTMLSpanElement {
    root = null;
    name = null;
    setup = new RunOnce(() => {
        this.root = hyperbeam.getContainingComponentRoot(this);
        if (this.root === undefined) {
            throw new Error(`ComponentField ${this} is not contained in a component!`);
        }
        if (this.hasAttribute("name")) {
            this.name = this.getAttribute("name");
            this.root.componentFields.set(this.name, this);
        }
    });
    
    connectedCallback() {
        this.setup.runOnce();
    }
};

customElements.define(
    "component-field",
    ComponentField,
    { extends: "span" }
);

hyperbeam.handleTag(
    "component-field",
    ComponentField
);