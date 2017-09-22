
import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('frames-are-equal', 'helper:frames-are-equal', {
  integration: true
});

// Replace this with your real tests.
test('it renders', function(assert) {
  this.set('inputValue', '1234');

  this.render(hbs`{{frames-are-equal inputValue}}`);

  assert.equal(this.$().text().trim(), '1234');
});

