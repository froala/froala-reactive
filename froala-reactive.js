/*
 * Froala-Reactive
 * ===============
 *
 * (c) 2014-2015 RSBA Technology Ltd
 *
 *  Wraps Froala Editor jQuery plugin into a reactive Meteor template object
 *
 * Implementation heavily based on 'x-editable-reactive-template' Meteor package
 * see: https://github.com/davidworkman9/x-editable-reactive-template
 *
 * Example Usage:
 *
 * {{> froalaEditor toolbarInline=true initOnClick=false saveInterval=2000
 *     _value=requirementParameter.text}}
 *
 * Set Froala Editor options as <option>=<value>
 * (see: https://froala.com/wysiwyg-editor)
 * This template will dynamically call option setter methods if any of the
 * provided option parameter values change, reactively.
 *
 * Register callbacks for Froala Editor events by prefixing the event name
 * by '_on'.  Callbacks get the same two parameters: e, editor provided by
 * Froala Editor's event callbacks.  The data context on the callbacks is set
 * from the data context of the froalaEditor template instance.
 *
 * onSaved: function () {
 *   var self = this;
 *   return function (e, editor) {
 *     // Do something
 *   };
 * }
 *
 * Pass the model value to be wrapped by the editor in the '_value' argument
 *
 * Override the template wrapper class by setting '_className' argument (default "froala-reactive-meteorized")
 *
 * If you save the contents of the editor with markers included, set the `_keepMarkers=true` argument to make sure the comparison between current & new content respects the marker html.
 *
 */

'use strict';

Template.froalaReactive.helpers({
  getClass: function () {
    var tmpl = Template.instance();
    return tmpl.wrapperClassName;
  }
});

Template.froalaReactive.onCreated(function () {
  var tmpl = this;
 tmpl.editor=null;
  tmpl.wrapperClassName = tmpl.data._className || "froala-reactive-meteorized";
})

Template.froalaReactive.onRendered(function () {
  var tmpl = this,
    $input = '.'+tmpl.wrapperClassName;
  tmpl.lastData = tmpl.data;


  initEditor(tmpl, tmpl.data, tmpl.lastData, $input);

  // Autorun block, re-run every time the data context changes
  tmpl.autorun(function () {
    if(tmpl.editor)
    {
    // Set up reactive dependency on template's data context
    var _data = Template.currentData();
    
    Tracker.nonreactive(function () {
    
      
      // Update HTML data wrapped within froala editor, if changed
      var currentHTMLWithMarkers = tmpl.editor.html.get( _data._keepMarkers /* keep_markers */);
      if (_data && currentHTMLWithMarkers !== _data._value) {
       // Avoid calling html.set with null
        // See: https://github.com/froala/wysiwyg-editor/issues/1061
        tmpl.editor.html.set( _data._value || "");
        _data._keepMarkers && tmpl.editor.selection.restore();
      }

      // Update froala editor option values, if changed
      var _changedOpts = _.filter(Object.keys(_data), function (opt) {
          // Find all option values whose value has changed
          // Exclude any opt properties that start with '_', reserved for
          // passing froala-reactive - specific parameters into the template
          // data context.
          return opt.indexOf('_')!==0 && !_.isEqual(tmpl.lastData[opt], _data[opt]);
      });
      if (_changedOpts.length > 0) {
        // Destroy and re-init the editor
        var _snapshot = tmpl.editor.snapshot.get();
        tmpl.editor.destroy();
        initEditor(tmpl, _data, tmpl.lastData, $input);
        tmpl.editor.snapshot.restore( _snapshot);
      }

      // Save current data context for comparison on next autorun execution
      tmpl.lastData = _data;
    })
    }
   });
});

/**
 * Ensure froalaEditor is properly removed to prevent memory leaks
 */
Template.froalaReactive.onDestroyed(function () {
 var tmpl=this;

if (!tmpl.editor ){
    // Restore internal 'froala_editor' reference to froala editor.
    // For some reason, by the time we get here in the destroyed procedure,
    // this jQuery data appears to have been wiped.
    // See: https://github.com/froala/froala-reactive/issues/2
     tmpl.__froala_editor = tmpl.editor;
  }

  // Destroy froala editor object itself
  // This may throw an exception if Meteor has already torn down part of the DOM
  // managed by Froala Editor, so we wrap this in a try / catch block to
  // silently ignore any such cases
  try {
    tmpl.editor .destroy();
  } catch (e) {}

});

/** Initialise Froala Editor instance */
function initEditor(tmpl, data, lastData, $input) {



  // Create Froala Editor instance, setting options & initial HTML content
  // from template data context

  data.events={
    initialized: function() {
      tmpl.editor=this;

      if (tmpl.data._value) {
        tmpl.editor.html.set(tmpl.data._value);
      }
  
      // Hack to provide destroyed callback with froala editor object,
      // by stuffing a reference to it in the template instance object.
      // See: https://github.com/froala/froala-reactive/issues/2
      tmpl.__froala_editor = this;

      // Set up additional event handlers
var eventHandlers = getEventHandlerNames(tmpl.data);
_.each(eventHandlers, function (opt) {
var _eventName =  opt.substring(3),instance=tmpl.editor; // Remove '_on' prefix
tmpl.editor.events.on(_eventName, function() {
  // Call callback, setting `this` to the latest, reactive, data context
  // of this template instance.
  // Callback function can use `this._value` to get up-to-date model value.
  // Also note that these callbacks fire AFTER the autorun function
  // has triggered if the data context changed. Hence, we pass the `lastData`
  // property as the data context for the callback function, not the original
  // `tmpl.data` object.
  var argumentArray=[tmpl.editor];
  for(var x=0;x<arguments.length;x++)
  {
  argumentArray.push(arguments[x]);
  }
  return tmpl.data[opt].apply(lastData,argumentArray);
});
});  
    }
  }
  
   new FroalaEditor($input,data);
 
  

}



/**
 * Internal function to parse any '_on<event>' event callback arguments
 */
function getEventHandlerNames(tmplData) {
 return _.filter(Object.keys(tmplData), function (opt) {
    return opt.indexOf('_on') === 0 && // Include if '_on...'
      _.isFunction(tmplData[opt]); // and handler is indeed a function
  });
}

