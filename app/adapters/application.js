import DS from 'ember-data';
import config from '../config';

export default DS.JSONAPIAdapter.extend({
  host: config.endpoints.server.host,
  namespace: config.endpoints.server.namespace
});
