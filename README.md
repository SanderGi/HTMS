# Hyper Text Markup Script - HTMS
What if HTML and JavaScript were one language? What if HTML variables had scope so we could easily organize our state directly in HTML properties and attributes instead of jumping hoops to sync the DOM with our JavaScript state? What if it was reactive and supported encapsulated components? HTMS.

```html
<h1>Todo List</h1>
<div #let:var1="''" #let:var2="''">
    <input type="text" 
        @input="(e) => this.var1 = e.target.value">
    <button 
        @click="() => this.var2 = `<li>${this.var1}</li>`">
        Add
    </button>
    <ul ::html+="var2"></ul>
</div>
```

Download and include as a script tag anywhere in any html file, no build step needed. Only 362 lines of code (6.3 kb minified and 2.5 kb gzipped). Recommended to put it in the `<head>`.

```html
<script type="module" src="ht.mjs"></script>
```

You can also use the CDN if you don't want to download anything:

```html
<script type="module" src="https://sandergi.github.io/cdn/ht.mjs"></script>
```

Or import it in your JavaScript file(s):

```javascript
import './ht.mjs';
```

## Overview
### Scoped State via Scriptable HTML Attributes

> **&#9432; The 3 characters you need to know**
> 
> : subscribes HTML [properties/attributes](https://stackoverflow.com/questions/6003819/what-is-the-difference-between-properties-and-attributes-in-html) to state variables.
>
> @ is used for listening to events.
> 
> \# is for special directives that annotate HTMS features on elements.

The key idea is that you can define variables on any [element](https://html.spec.whatwg.org/multipage/indices.html#elements-3) using `#let:` and that variable will be accessible on that element and its children -- you can think of this like defining normal JavaScript variables using `let` and each element has its own block scope.

You can subscribe any [attribute](https://html.spec.whatwg.org/multipage/indices.html#attributes-3) to the value of a variable by prefixing the attribute name with a `:` and assigning to the variable name. It will automatically update whenever the value of the variable updates.

```html
<div #let:var1="'hello'">
    <input type="text" :placeholder="var1">
</div>
```

Subscribing properties to state changes are done much the same way but using `::`. You can for example sync the value of two inputs this way:

```html
<div #let:var1="'hello'">
    <input type="text" ::value="var1" @input="(e) => {this.var1 = e.target.value}">
    <h1 ::text="var1">Test</h1>
    <input type="text" ::value="var1" @input="(e) => {this.var1 = e.target.value}">
</div>
```

> **&#9432;** `::text` is shorthand for `::text-content` and `::html` is shorthand for `::inner-h-t-m-l`

> **&#9432;** With `::`, hyphens indicate the next character is capitalized (since attributes ignore case), an extra hypen `--` escapes the following hyphen. 

> **&#9432;** The simplest way to update state variables is to do it when browser (or custom) [events](https://html.spec.whatwg.org/multipage/indices.html#events-2) are fired on elements. Event listeners attached with `@` followed by any event name, will call the event handler in their attribute value with `this` scoped to the state of the element whenever the event fires on/bubbles up to that element.

### Encapsulated Composable Components
Creating a component is as simple as annotating a `<template>` with `#component` anywhere in the HTML file:

```html
<template #component="example-component">
    <h1>Include any HTML in here!</h1>
</template>
```

And the component can now be used as many times as you want anywhere in the file with the `<example-component></example-component>` tag.

> **&#9432; `#component` creates a Web Component**
>
> That means the name of the component must have one "-" and be lowercase.
>
> It also means any styles you set inside it won't apply globally and global styles wont apply inside it. 
>
> Element ids are also in a separate context so re-used ids wont conflict between components and the main document. 
>
>Read more about the underlying [Web Component API here](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements).

Components are encapsulated and cannot access their parents state. You should instead pass in values via attributes.

```html
<template #component="test-component" var1="'default value'">
    <h1 ::text="var1">Test</h1>
    <input type="text" ::value="var1" @input="(e) => {this.var1 = e.target.value}">
</template>

<!-- Use the default: -->
<test-component></test-component>
<!-- Pass in a value to override the default: -->
<test-component var1="awesome pizza"></test-component>
<!-- Reactively bind the value to another variable: -->
<test-component :var1="var2"></test-component>
```

Script tags inside components are scoped to that component, so `this` refers to the state of the component. You can use this to define functions/callbacks and set/initialize variables for the component.

```html
<!-- Lists a new random number on button click -->
<template #component="random-list" #let:items="''">
    <button @click="this.add">Add</button>
    <ul ::html="items"></ul>
    <script>
        this.add = () => {
            this.items += `<li>${Math.random()}</li>`;
        }
    </script>
</template>
```

> **&#9432;** Use `this[component].dispatchEvent` to trigger a [custom event](https://developer.mozilla.org/en-US/docs/Web/Events/Creating_and_triggering_events) on the component when you need to pass output to the clients of the component.

> **&#9432;** Use the `<slot>` tag (see [the docs](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/slot)) to include the child elements of a component and pass around markup.

## Standard Library of Reusable Components
Coming soon...

## LSP and VS Code plugin
Coming soon...

## Performance and Security
Coming soon...

## Advanced Features

### Special State Keys

Every state that is part of a component has access to that component element via the `component` symbol. This can for example be used to make a component that can delete itself from the DOM when clicked:

```html
<template #component="deletable-cross">
    <p @click="(e) => this[component].remove()">❌</p>
</template>
```

>**&#9432;** It is also very useful to access the shadowRoot of the component `this[component].shadowRoot` to do DOM fragment manipulations like `this[component].shadowRoot.getElementById` since the document does not have access to the encapsulated contents of a component via `document.getElementById`.

Every state object has access to the previous version of each of the variables declared on its element. You can access this using the `old` symbol.

```html
<div #let:var1="'hi'" #let:var3|var1="this.var1 + (this.var3 || ' 3').replace(this[old].var1, '')">
    <h1 ::text="var1">Test</h1>
    <input type="text" :value="var1" @input="(e) => {this.var1 = e.target.value}">
    <h1 ::text="var3">Test</h1>
    <input type="text" :value="var3" @input="(e) => {this.var3 = e.target.value}">
</div>
```

The last symbol is `element` which is the element that the state is attached to. This can be used to access the DOM element directly. This is a useful distinction from the event target since the event could be triggered on a child element in which case `this[element]` will be the element with the `@` event listener and `e.target` will be the child element that triggered the event.

```html
<div @click="(e) => console.log(e.target, this[element])">
    <button>Hello</button>
</div>
```

>**&#9432;** In addition to being available in all HTMS attributes (`:`, `@`, `#let`) and component script tags, the symbols can also be imported in any JavaScript module via `import { old, element, component } from 'ht.mjs';`.

### The `$state` Property

Every element has a `$state` property that you can use to get/set the variables available in its scope. You can give elements ids and `document.getElementById` them (or use any other DOM method) to access this. To ensure HTMS has been set up before trying to access `$state`, you can import the `ht.mjs` module in your script.

```html
<div #let:var1>
    <input type="text" :value="var1">
    <script type="module" id="id1">
        import './ht.mjs';
        const state = document.getElementById('id1').$state;
        state.var1 = 'hi';
    </script>
</div>
```

If you don't like using getElementById, you can annotate any element with `#jsvar` and import that state as a variable in your script instead:

```html
<div #let:var1>
    <input type="text" ::value="var1" #jsvar="myStateVar">
    <script type="module">
        import { jsvars } from './ht.mjs';
        const { myStateVar } = jsvars;
        myStateVar.var1 = 'hi';
    </script>
</div>
```

### Subscribing Attributes/Properties to Template Strings

For complicated object attributes (works for properties too) like style, it makes sense to provide the general content via a template string and springle in reactive variables:

```html
<div #let:display="'block'" #let:color="'#ffffff'" #let:opacity="1"
    :style="display: ${this.display}; background-color: ${this.color}; opacity: ${this.opacity}; height: 300px;">
    <input type="color" ::value="color" @input="(e) => {this.color = e.target.value}">
    <input type="range" ::value="opacity" min="0" max="1" step="0.1" @input="(e) => {this.opacity = e.target.value}">
    <button @click="(e) => {this.display = 'none'}">Hide</button>
</div>
```

> &#9432; This can also be used to perform JavaScript manipulations on state variables before assigning to attributes/properties and even allows using `window` properties.
> ```html
> <input type="range" min="0" :max="${window.innerWidth / 2}" step="0.1">
> ```

### Subscribing Nested Properties

For properties (not attributes, but style happens to be both an attribute and property) you can also set the specific nested properties you need by adding dots in your `::` attribute:

```html
<div #let:display="'block'" #let:color="'#ffffff'" #let:opacity="1"
    ::style.display="display" ::style.background-color="color" ::style.opacity="opacity" style="height: 100px">
    <input type="color" ::value="color" @input="(e) => {this.color = e.target.value}">
    <input type="range" ::value="opacity" min="0" max="1" step="0.1" @input="(e) => {this.opacity = e.target.value}">
    <button @click="(e) => {this.display = 'none'}">Hide</button>
</div>
```

> &#9432; You can still use template string for nested properties

### Event Options
You can tweak how event listeners are handled using the [default browser options](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener) (`once`, `passive`, `capture`) and two HTMS options `delay` and `throttle`. Both HTMS options take a numerical argument in milliseconds. Every event is delayed by `delay` ms before calling the event handler. If multiple events are fired within `throttle` ms, only the last one takes effect. The options can go in any order and are separated by pipes `|`:

```html
<button @click|throttle:1000="() => this[element].textContent += 's'">ye</button>
<button @click|once|delay:1000="() => this[element].textContent = 'nope'">I only work once and always wait 1000ms!</button>
```

### Fetch Events
A third HTMS event option is `fetch` which changes the attribute value syntax to `fetch arguments -> target [-> subtarget]`. The fetch arguments include a url and optional options object just like the browser [fetch](https://developer.mozilla.org/en-US/docs/Web/API/fetch). The result will be fetched and if its in the 200-299 status code range, it will be parsed and placed in the target. The simplest target is `console` which will console.log the fetched response:

```html
<button @click|fetch="'https://corsproxy.io/?gooey.ai%2Fqr%2F' -> console">Console Log Fetch Result</button>
```

By default, the text content of the response will be used. You can specify any of 'json', 'formData', 'blob', or 'arrayBuffer' as well.
```html
<button @click|fetch:json="'data:application/json;charset=utf-8;base64,eyJoZWxsbyI6IndvcmxkIn0=' -> console">Console Log Fetch Result</button>
```

You can also use `this` as the target which will take the json of the response and use the parsed object to update the state object of the element. Each key sets the state variable with the same name to the corresponding value.

```html
<button #let:hello="'Fetch State Update'" ::text="hello" @click|fetch="'data:application/json;charset=utf-8;base64,eyJoZWxsbyI6IndvcmxkIn0=' -> this"></button>
```

More directly, set the target to any variable name to only update that variable with the fetch response.

```html
<button #let:hello="'Fetch Directly To Variable'" ::text="hello" @click|fetch="'data:application/json;charset=utf-8;base64,eyJoZWxsbyI6IndvcmxkIn0=' -> hello"></button>
```

The final target is a query selector. It will by default replace the innerHTML of the first element in the document that matches the selector but an optional subtarget can be included to replace/insert at any of 'beforeBegin', 'afterBegin', 'beforeEnd', 'afterEnd', 'textContent', or 'outerHTML'.

```html
<button id="hello" @click|fetch="'data:application/json;charset=utf-8;base64,eyJoZWxsbyI6IndvcmxkIn0=' -> #hello -> afterEnd">Insert Fetch Response Text as HTML</button>
```

You still have access to the triggering event `e` and the state via `this` in the fetch arguments so you can, for instance, use these to set the headers on the request.

```html
<button #let:var1="POST" @click|fetch="'https://example.api?id=' + e.pointerId, {method: this.var1, headers: {Authorization: 'Bearer ' + this.secret}} -> .user-messages">Fetch Authenticated Response</button>
```

### Component Lifecycle Hooks
By default, script tags in components run when a component element instance is being constructed. You can annotate them with `#onConnected` and `#onDisconnected` to run them when added to/removed from the DOM respectively (see [the underlying web component lifecycle hooks](https://ultimatecourses.com/blog/lifecycle-hooks-in-web-components)).

```html
<lifecycle-component></lifecycle-component>
<template #component="lifecycle-component">
    Check The Console For which code runs in which order.
    <button @click="() => this[component].remove()">Remove from DOM to test #onDisconnected</button>
    <script>
        console.log('runs when element is constructed');
    </script>
    <script #onConnected>
        console.log('runs when element is connected to the DOM');
    </script>
    <script #onDisconnected>
        console.log('runs when element is removed from the DOM');
    </script>
</template>
```

### HTMS Imports
HTMS lets you annotate link tags in the `<head>` with `#include`. The text content of the linked file will be fetched and inserted at the target indicated by the attribute value.

```html
<!-- Default target is at the end of the document.body -->
<link rel="preload" href="example.html" as="fetch" crossorigin="anonymous" #include>
<!-- Targets specify a query selector and subtarget. See the Fetch Events section -->
<link rel="preload" href="example.html" as="fetch" crossorigin="anonymous" #include="#id1 -> outerHTML">
```
> **&#9432;** Imports are useful to include reusable components from different files when used in static files. If you have access to a good templating language on the server and are not using free static hosting for everything, that would likely be cleaner. 

### State Management with `#let-url`, `#let-local` and `#let-session`

By default, state variables live in memory meaning they're lost when the user refreshes or leaves the site. HTMS allows you to persist variables in the URL, [local storage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage), and [session storage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage). These are scoped just like regular state variables but variable names must be unique (there's only one global URL afterall) and the attribute value is treated like a default and only evaluated/used if there is not already a value set in the URL/LocalStorage/SessionStorage.

```html
<!-- Session storage persists when the site is refreshed but resets between different tabs or when the browser is closed. Useful for storing credentials, etc. -->
<input type="text" #let-session:val="`I'm saved in session storage`" ::value="val" @input="(e) => {this.val = e.target.value}">

<!-- Local storage persists (unless it exceeds the browser memory threshold) between tabs and browsing sessions -->
<input type="text" #let-local:val="`I'm saved in local storage`" ::value="val" @input="(e) => {this.val = e.target.value}">

<!-- Syncing variables with the URL allows the user to go back to a state (e.g. when refreshing or from a bookmark) and facilitates easy sharing with friends -->
<input type="text" #let-url:val="`I'm saved in the url`" ::value="val" @input="(e) => {this.val = e.target.value}">
```

### Reactive `#let` Statements
By default, `#let` statements only evaluate their attribute once to avoid unintentional infinite reactive loops (two variables defined based on each other). You can manually specify dependencies separated by pipes `|` and the declared variable will be recomputed every time one of those dependencies change.

```html
<input type="text" #let:var1="'hello'" #let:var2|var1="this.var1 + '!'" ::value="var2">
```

## Examples

### Todo List
Implements the same functionality as this [Svelte example](https://svelte.dev/repl/7eb8c1dd6cac414792b0edb53521ab49?version=3.20.1):
```html
<h1>Todo List</h1>
<div #let:input="''" #let:item="''">
    <input type="text" placeholder="New Item" ::value="input" 
        @input="(e) => this.input = e.target.value">
    <button @click="add">Add</button>
    <ul ::html+="item" style="list-style-type: none">
        <todo-item>Write my first post</todo-item>
        <todo-item>Upload the post to the blog</todo-item>
        <todo-item>Publish the post at Facebook</todo-item>
    </ul>
</div>
<script>
    function add() {
        this.item = `<todo-item>${this.input}</todo-item>`;
        this.input = '';
    }
</script>
<template #component="todo-item">
    <li #let:status>
        <input type="checkbox"
            @change="(e) => this.status = e.target.checked">
        <span :checked="status"><slot></slot></span>
        <span @click="(e) => this[component].remove()">
            ❌
        </span>
    </li>
    <style> 
        span[checked="true"] {
            text-decoration: line-through;
        }
    </style>
</template>
```

## Contributors
Inspired by [HTMX](https://htmx.org/) and [Not A Framework](https://github.com/awesome-club/not-a-framework).

All contributions -- issues to discuss new features, pull requests with bug fixes, performance impovements, tests, documentation, and more -- are welcome and contributors will be listed here.

## License
MIT so feel free to use this for anything you want. If you make anything cool please share and it'll be listed here!
