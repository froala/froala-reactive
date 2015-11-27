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
  tmpl.wrapperClassName = tmpl.data._className || "froala-reactive-meteorized";
})

Template.froalaReactive.onRendered(function () {
  var tmpl = this,
    lastData = tmpl.data,
    $input = tmpl.$('.'+tmpl.wrapperClassName),
    froalaMethod;

  if ($input.length !== 1) {
    throw new Error ('invalid-froala-reactive-template');
  }

  froalaMethod = getFroalaEditorJQueryInstanceMethod($input);
  if (!froalaMethod) {
    throw new Error('invalid-froala-editor-plugin');
  }

  initEditor(tmpl, tmpl.data, lastData, $input, froalaMethod);

  // Autorun block, re-run every time the data context changes
  tmpl.autorun(function () {
    var self = this;

    // Set up reactive dependency on template's data context
    var _data = Template.currentData();

    // Update HTML data wrapped within froala editor, if changed
    var currentHTMLWithMarkers = $input[froalaMethod]('html.get', _data._keepMarkers /* keep_markers */);
    if (_data._value && !_.isEqual(currentHTMLWithMarkers, _data._value)) {
      $input[froalaMethod]('html.set', _data._value);
      _keepMarkers && $input[froalaMethod]('selection.restore');

    }

    // Update froala editor option values, if changed
    var _changedOpts = _.filter(Object.keys(_data), function (opt) {
        // Find all option values whose value has changed
        // Exclude any opt properties that start with '_', reserved for
        // passing froala-reactive - specific parameters into the template
        // data context.
        return opt.indexOf('_')!==0 && !_.isEqual(lastData[opt], _data[opt]);
    });
    if (_changedOpts.length > 0) {
      // Destroy and re-init the editor
      var _snapshot = tmpl.editor.froalaEditor('snapshot.get');
      tmpl.editor.froalaEditor('destroy');
      initEditor(tmpl, _data, lastData, $input, froalaMethod);
      tmpl.editor.froalaEditor('snapshot.restore', _snapshot);
    }

    // Save current data context for comparison on next autorun execution
    lastData = _data;
   });
});

/**
 * Ensure froalaEditor is properly removed to prevent memory leaks
 */
Template.froalaReactive.onDestroyed(function () {
 var tmpl = this,
    $input = tmpl.$('.'+tmpl.wrapperClassName),
    froalaMethod;

  froalaMethod = getFroalaEditorJQueryInstanceMethod($input);
  if (!froalaMethod) {
    return;
  }

  if (!$input.data('froala.editor')) {
    // Restore internal 'froala_editor' reference to froala editor.
    // For some reason, by the time we get here in the destroyed procedure,
    // this jQuery data appears to have been wiped.
    // See: https://github.com/froala/froala-reactive/issues/2
    $input.data('froala.editor', tmpl.__froala_editor);
  }

  // Destroy froala editor object itself
  // This may throw an exception if Meteor has already torn down part of the DOM
  // managed by Froala Editor, so we wrap this in a try / catch block to
  // silently ignore any such cases
  try {
    $input[froalaMethod]('destroy');
  } catch (e) {}

  // Workround for https://github.com/froala/wysiwyg-editor/issues/844
  $('.fr-modal').remove();
  $('.fr-overlay').remove();
});

/** Initialise Froala Editor instance */
function initEditor(tmpl, data, lastData, $input, froalaMethod) {
  // Create Froala Editor instance, setting options & initial HTML content
  // from template data context
  tmpl.editor = $input[froalaMethod](data);
  if (tmpl.data._value) {
    $input[froalaMethod]('html.set', data._value);
  }

  // Hack to provide destroyed callback with froala editor object,
  // by stuffing a reference to it in the template instance object.
  // See: https://github.com/froala/froala-reactive/issues/2
  tmpl.__froala_editor = $input.data('froala.editor');

  // Set up additional event handlers
  var eventHandlers = getEventHandlerNames(tmpl.data);
  _.each(eventHandlers, function (opt) {
    var _eventName = 'froalaEditor.' + opt.substring(3); // Remove '_on' prefix
    $input.on(_eventName, function (e) {
      e.preventDefault();
      // Call callback, setting `this` to the latest, reactive, data context
      // of this template instance.
      // Callback function can use `this._value` to get up-to-date model value.
      // Also note that these callbacks fire AFTER the autorun function
      // has triggered if the data context changed. Hence, we pass the `lastData`
      // property as the data context for the callback function, not the original
      // `tmpl.data` object.
      tmpl.data[opt].apply(lastData, arguments);
    });
  });
}

/**
 * Internal function to return correct Froala Editor instance method name
 *
 */
function getFroalaEditorJQueryInstanceMethod(froalaJQueryObject) {
  if (froalaJQueryObject) {
    if (_.isFunction(froalaJQueryObject.froalaEditor)) {
      // Original froala jQuery instance method
      return 'froalaEditor';
    }
  }
  // Whoops! Looks like froala editor code has not been loaded
  return null;
};

/**
 * Internal function to parse any '_on<event>' event callback arguments
 */
function getEventHandlerNames(tmplData) {
 return _.filter(Object.keys(tmplData), function (opt) {
    return opt.indexOf('_on') === 0 && // Include if '_on...'
      _.isFunction(tmplData[opt]); // and handler is indeed a function
  });
}

