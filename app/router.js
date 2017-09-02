import Ember from 'ember';
import config from './config/environment';

const Router = Ember.Router.extend({
    location: config.locationType
});

Router.map(function () {
  this.route('create');
  this.route('project', { path: '/projects/:project_id' });
  this.route('gallery');
});

export default Router;
