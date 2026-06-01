# Hyperbeam

A library for reactive web guis with a focus on placing as much of the functionality and data into the hypertext as possible.

It is a single `.js` file that you can drag into your projects with full inline JSDoc support.

## Components

The fundimental idea is to clump multiple tags together into a *component* where the boundary is dictated by the hypertext itself;
specifically via the tags `component-root` and `component-field`:

```html
<!-- outside -->

<component-root class="example other" n="24">
    <component-field name="foo">

        <!-- outside -->

    <component-field>

    <!-- inside -->

    <div>
        <component-field name="bar">

            <!-- outside -->

        <component-field>
    </div>

    <!-- inside -->

</component-root>
```

The `component-field`s essentially act as escapes and the `component-root` defines the start.
They will automatically add a class matching the first class on the matching `component-root` on linking.
That being said we do need a little javascript to make this useful:

```js
class Example extends Component {
    async onInit(builder) {
        await builder.linkElement("foo");
        await builder.linkElement("bar");
        builder.linkAttribute("n");
    }
}

hyperbeam.supportClass("example", Example);

hyperbeam.start();
```

This defines a class to represent the component,
the initialised instance can be accessed from any event handler inside the component by calling `$(this)`.

Here are some things you could do:
- `$(this).n += 1`
- `hyperbeam.swap($(this).foo, $(this).bar)`
- `$(this).hypertext = "<p>Lorem ipsum.</p>"`

One of the main advantages to controlling things this way is that more of the layout and interactivity decisions are present in the hypertext.
To facilitate this further all views come with a `.preserve()` method that removes the content from flow,
assigns the content a unique id, and returns the hypertext for a custom tag that will replace itself with the element.

## Views

A simple cleaner API for hypertext manipulation, including:
- `selectAll`, `select`, and `ancestor` css querying where the underlying element has temporary id `this`.
- `append`, `prepend`, `move` and `replaceWith` functions for sensible manipulations.
- `focus` and `handleFocus` for dealing with keyboard / click navigation.
- `element` for when you want to get back to the normal API.

## Navigation

Keyboard navigation is built ontop the `tabIndex` and focus system to make it easier to use, not replace it.

The custom attribute `focus-net` allows one to move deeper into the page with enter and back out using escape,
remembering where you left off if you decide to come back.

The custom attribute `arrow-nav` allows you to navigate between focusable children using the arrow keys.
It does this by alernating between navigation styles of horizontal and vertical strips based on computed relative positions,
as far as I am aware, this is the best I can do without making too many assumptions.
