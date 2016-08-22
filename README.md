# Dotplot - Telling a story through dots

DotPlot is a data visualisation tool built on top of [D3.js](https://d3js.org/) to help non-programmers create interactive data visualisations using easy to use drag and drop interface.  

### Create View (Create or Edit DotPlot Projects)
![DotPlot App Screenshot](/public/assets/docs/screenshot.png?raw=true)

### Presentation View (Share or Present DotPlot Projects)
![DotPlot Presentation Screenshot](/public/assets/docs/screenshot2.png?raw=true)

## Prerequisites

To contribute to this project, you will need the following things properly installed on your computer.

* [Git](http://git-scm.com/)
* [Node.js](http://nodejs.org/) (with NPM)
* [Bower](http://bower.io/)
* [Ember CLI](http://ember-cli.com/)
* [PhantomJS](http://phantomjs.org/)

## Installation

* `git clone https://github.com/berkmancenter/dotplot.git` this repository
* change into the new directory
* `npm install`
* `bower install`

## Running / Development

* `ember server`
* Visit your app at [http://localhost:4200/create](http://localhost:4200/create).
* Public View: `http://localhost:4200/project?id=<Your Project Id>`.

### Code Generators

Make use of the many generators for code, try `ember help generate` for more details

### Running Tests

* `ember test`
* `ember test --server`

### Building

* `ember build` (development)
* `ember build --environment production` (production)

### DotPlot Guide

![DotPlot Guide 1](/public/assets/docs/dotplot-guide-1.png?raw=true)  
![DotPlot Guide 2](/public/assets/docs/dotplot-guide-2.png?raw=true)  
![DotPlot Guide 3](/public/assets/docs/dotplot-guide-3.png?raw=true)  
![DotPlot Guide 4](/public/assets/docs/dotplot-guide-4.png?raw=true)  
![DotPlot Guide 5](/public/assets/docs/dotplot-guide-5.png?raw=true)  
![DotPlot Guide 6](/public/assets/docs/dotplot-guide-6.png?raw=true)  

## Further Reading / Useful Links

* [ember.js](http://emberjs.com/)
* [ember-cli](http://ember-cli.com/)
* Development Browser Extensions
  * [ember inspector for chrome](https://chrome.google.com/webstore/detail/ember-inspector/bmdblncegkenkacieihfhpjfppoconhi)
  * [ember inspector for firefox](https://addons.mozilla.org/en-US/firefox/addon/ember-inspector/)
  
## Ember Actions Help

### loadProject (Function, Observer)

**Accepts:** None  
**Use:** Calls `importJSONData` if a valid Project ID is provided.  

### labelToggle (Function, Observer)

**Accepts:** None  
**Use:** Observes `showLabel` property and calls `showLabels` or `removeLabels`.

### getNodes (Function, Promise)

**Accepts:** Type of frame (String)  
**Returns:** An array of node objects.

### getFoci (Function)

**Accepts:** Number of choices (Array)  
**Returns:** An array of foci coordinates.

### createFrame (Ember Action)

**Accepts:** None  
**Action:** Calls another action based on the type of frame.

### createSingleChoice (Ember Action)

**Accepts:** None  
**Action:** Creates a new record for a single choice frame and calls d3Init (Run force layout).

### createMultipleChoice (Ember Action)

**Accepts:** None  
**Action:** Creates a new record for a multiple choice frame and calls `d3Init` (Run force layout).

### createDialog (Ember Action)

**Accepts:** None  
**Action:** Displays `createFrame` model if CSV file is loaded.  

### deleteFrame (Ember Action)

**Accepts:** Frame (Object)  
**Action:** Deletes the frame record based on the provided frame object.

### showModel (Ember Action)

**Accepts:** Element Id (String)  
**Action:** Displays dialog based on the provided id.

### hideModel (Ember Action)

**Accepts:** Element Id (String)  
**Action:** Hides dialog based on the provided id.

### fileUpload (Ember Action)

**Accepts:** File (Object)  
**Action:** Calls `importJSONData` or `importCSVData` based on the file type.

### importJSONData (Ember Action)

**Accepts:** File (Object)  
**Action:** Creates new frame records using the data in the provided JSON file.

### importCSVData (Ember Action)

**Accepts:** File (Object)  
**Action:** Extracts different columns from the CSV file and creates node objects. Allows to create frames from scratch.

### selectColumn (Ember Action)

**Accepts:** Column (Object)  
**Action:** Updates the `selectedColumn` (Question) and highlights the selection.

### d3Init (Ember Action)

**Accepts:** Frame (Object)  
**Action:** Updated nodes data, removes the nodes that are not in the data `exit()` creates nodes that are not on the SVG `enter()` and calls force layout action `d3Plot`.

### nodeClick (Ember Action)

**Accepts:** Node Selection (Object) and Frame (Object)  
**Action:** Finds all the nodes using nodeId (Including Duplicate Nodes), increases the node radius and calls the `nodeInfo` action.

### nodeInfo (Ember Action)

**Accepts:** Node Selection (Object)  
**Action:** Displays node information DOM Element (Question Answer Sets).

### hideNodeInfo (Ember Action)

**Accepts:** None  
**Action:** Hides the node info DOM Element.

### d3Plot (Ember Action)

**Accepts:** Frame (Object)  
**Action:** Updates nodes data and runs force layout `force.start()`.

### removeLabels (Ember Action)

**Accepts:** None  
**Action:** Selects all the labels on the SVG and removes them.

### showLabels (Ember Action)

**Accepts:** Frame (Object) and updatePosition (Boolean)  
**Action:** Updated label data and creates labels 'enter()'.

### updateLabels (Ember Action)

**Accepts:** None  
**Action:** Hides editLabel dialog, calls `showLabels` action after `removeLabels`.

### saveNodePositions (Ember Action)

**Accepts:** Frame (Object)  
**Action:** Iterates over nodes on the SVG and updates the X and Y coordinates of the nodes in the frame object.

### changeGravity (Ember Action)

**Accepts:** Change Event (Object)  
**Action:** Sets new gravity value and calls `d3Plot` action after `removeLabels` action.

### changeCharge (Ember Action)

**Accepts:** Change Event (Object)  
**Action:** Sets new charge value and calls `d3Plot` action after `removeLabels` action.

### changeRadius (Ember Action)

**Accepts:** Change Event (Object)  
**Action:** Transitions into new radius value `transition()`.

### selectFrame (Ember Action)

**Accepts:** Frame (Object)  
**Action:** Updates the nodes data, removes nodes that are not in the data `exit()` creates nodes that are not on the SVG `enter()` and transitions into the specified node positions.

### showNotification (Ember Action)

**Accepts:** Type of notification [Error, Warning, Info, Success] (String)  and Notification Message (String)  
**Action:** Displays a notification at the bottom of the view which automatically disappears after 2200ms.

### sendToServer (Ember Action)

**Accepts:** File (Blob) and File Name (String)  
**Action:** Posts the data to `/api/project` and displays a notification with Project ID Hash.    

### exportData (Ember Action)

**Accepts:** Type (String)  
**Action:** Iterates over all the frame records and creates a Blob, calls `sendToServer` if the type is Publish or else downloads a json file `DotPlot.json`.  