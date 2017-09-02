import DS from 'ember-data';
import { serverConf } from '../config';

export default DS.JSONAPIAdapter.extend({
  host: serverConf.host,
  namespace: serverConf.namespace
});
