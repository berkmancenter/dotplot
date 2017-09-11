import Ember from 'ember';
import config from './config/environment';

const Router = Ember.Router.extend({
    location: config.locationType
});

Router.map(function () {
  this.route('projects', function() {
    this.route('new');
    this.route('view', { path: '/:project_id' });
    this.route('edit', { path: '/:project_id/edit' });
  });
  this.route('gallery');
});

export default Router;
