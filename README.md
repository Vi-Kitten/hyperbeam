# Hyperbeam

A library for reactive web guis with a focus on placing as much of the functionality and data into hypertext as possible.

The fundimental idea is to clump multiple tags together into a *component* where the boundary is dictated by the hypertext itself;
specifically via the tags `component-root` and `component-field`:

```html
<!-- outside -->

<component-root class="example" n="24">
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
assigns the content a unique id,
and returns the hypertext for a custom tag that move it back into place.
