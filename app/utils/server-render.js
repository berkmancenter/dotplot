import * as config from '../config';
import Ember from 'ember';

export default function serverRender(serverObject) {
  return Ember.$.ajax({
    type: 'POST',
    url: config.serverConf.renderEndpoint,
    data: {
      id: serverObject.frame.get('id'),
      nodes: JSON.stringify(serverObject.frame.get('nodes')),
      foci: JSON.stringify(serverObject.foci),
      charge: serverObject.charge,
      gravity: serverObject.gravity,
      width: serverObject.width,
      height: serverObject.height
    },
  });
};