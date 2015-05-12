'use strict';

/* global MockNotif, nunjucks, QuestionController, SumoDB, User, Utils */

require('/shared/test/unit/load_body_html_helper.js');

require('/test/unit/mocks/mock_notifications.js');
require('/test/unit/mocks/mock_nunjucks.js');
require('/test/unit/mocks/mock_sumo_db.js');
require('/test/unit/mocks/mock_user.js');

require('/js/libs/lodash.custom.min.js');
require('/js/utils.js');

var mocksFor = new MocksHelper([
  'nunjucks',
  'SumoDB',
  'User'
]).init();

suite('QuestionController', function() {
  this.timeout(500);

  mocksFor.attachTestHelpers();

  const FAKE_USER = {
  };
  const DISPLAYED_QUESTION_ID = 12;
  const FAKE_REALTIME_ID = 13;

  const DISPLAYED_QUESTION = {
    content: '<p><br>\n</p>',
    created: '2015-03-04T09:53:53Z',
    creator: {
      username: 'spongebob',
      display_name: 'spongebob',
    },
    id: 1011143,
    metadata: [],
  };
  const ANSWERS_FOR_DISPLAYED_QUESTION = [
    {
      id: 101,
      question: DISPLAYED_QUESTION_ID,
      content: '<p>wrgwg\n</p>',
      created: '2015-03-04T09:57:51Z',
      creator: {
        username: 'spongebob',
        display_name: 'spongebob',
      },
      updated: '2015-03-04T09:57:51Z',
      updated_by: null,
    },
    {
      id: 100,
      question: DISPLAYED_QUESTION_ID,
      content: '<p>wesh\n</p>',
      created: '2015-03-04T09:55:34Z',
      creator: {
        username: 'patrick_the_star',
        display_name: 'Patrick the star',
      },
      updated: '2015-03-04T09:55:34Z',
      updated_by: null,
    }
  ];

  const REALTIME_ANSWER_BEFORE_DISPLAYING = {
    action_object: {
      id: 1,
      creator: 'foo'
    },
    verb: 'answered'
  };

  const REALTIME_ANSWER_AFTER_DISPLAYING = {
    action_object: {
      id: 1000,
      creator: 'foo'
    },
    verb: 'answered'
  };

  setup(function() {
    this.sinon.stub(User, 'get_user').returns(Promise.resolve(FAKE_USER));
  });

  suite('realtime', function() {
    setup(function(done) {
      window.parent.Notif = MockNotif;

      this.sinon.stub(User, 'is_helper').returns(Promise.resolve(true));

      this.sinon.stub(Utils, 'get_url_parameters')
        .returns({id: DISPLAYED_QUESTION_ID});
      this.sinon.stub(Utils, 'time_since');
      this.sinon.stub(SumoDB, 'get_question').withArgs(DISPLAYED_QUESTION_ID)
        .returns(DISPLAYED_QUESTION);
      this.sinon.stub(SumoDB, 'get_answers_for_question')
        .withArgs(DISPLAYED_QUESTION_ID)
        .returns(ANSWERS_FOR_DISPLAYED_QUESTION);

      this.sinon.stub(MockNotif, 'get_realtime_id')
        .withArgs(DISPLAYED_QUESTION_ID)
        .returns(Promise.resolve(FAKE_REALTIME_ID));

      this.sinon.stub(SumoDB, 'get_new_answers').withArgs(FAKE_REALTIME_ID)
        .returns(Promise.resolve([
          REALTIME_ANSWER_BEFORE_DISPLAYING,
          REALTIME_ANSWER_AFTER_DISPLAYING
        ]));

      this.sinon.spy(MockNotif, 'listen_to_realtime');
      this.sinon.spy(nunjucks, 'render');

      loadBodyHTML('/question.html');

      require('/js/question_controller.js', function() {
        QuestionController.init();
        QuestionController.display_new_answers().then(done);
      });
    });

    test('listens for realtime', function() {
      sinon.assert.calledWith(MockNotif.listen_to_realtime,
        DISPLAYED_QUESTION_ID);
    });

    test('gets the list of new answers', function() {
      sinon.assert.calledWith(SumoDB.get_new_answers, FAKE_REALTIME_ID);
    });

    test('only display new answers since last time', function() {
      sinon.assert.calledOnce(nunjucks.render.withArgs('thread.html'));
    });
  });

  suite('submit_comment', function() {
    var submit_button;
    setup(function(done) {
      loadBodyHTML('/question.html');

      submit_button = document.getElementById('question_submit_button');
      this.sinon.spy(submit_button, 'addEventListener');

      require('/js/question_controller.js', function() {
        QuestionController.init();
        done();
      });
    });

    test('only sends comment if none is in flight', function(done) {
      document.getElementById('question_field').value = 'foo';
      this.sinon.stub(SumoDB, 'post_answer')
      .returns(Promise.resolve(ANSWERS_FOR_DISPLAYED_QUESTION[0]));
      var submit_comment = submit_button.addEventListener.firstCall.args[1];

      var fake_evt = {preventDefault: () => {}};
      var promises = [];
      promises.push(submit_comment(fake_evt));
      promises.push(submit_comment(fake_evt));

      Promise.all(promises).then(() => {
        sinon.assert.calledOnce(SumoDB.post_answer);
      }).then(() => {
        document.getElementById('question_field').value = 'foo';
        return submit_comment(fake_evt);
      }).then(() => {
        sinon.assert.calledTwice(SumoDB.post_answer);
      }).then(done, done);
    });
  });

});
