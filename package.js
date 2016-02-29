Package.describe({
  name: 'froala:editor-reactive',
  summary: 'A Meteor reactive template wrapper around Froala WYSIWYG HTML Rich Text Editor.',
  version: '2.2.0',
  git: 'https://github.com/froala/froala-reactive.git'
});

Package.onUse(function(api) {
  api.versionsFrom('1.0');

  // Declare package dependencies
  api.use([
    'froala:editor@2.2.0',
    'templating',
    'underscore'
    ], 'client');

  // package files
  api.addFiles([
    'froala-reactive.html',
    'froala-reactive.js'
    ], 'client');
});

