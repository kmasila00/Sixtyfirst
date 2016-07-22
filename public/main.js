'use strict';

window.app = angular.module('CapstoneApp', ['fsaPreBuilt', 'ui.router', 'ui.bootstrap', 'ngAnimate']);

app.config(function ($urlRouterProvider, $locationProvider) {
  // This turns off hashbang urls (/#about) and changes it to something normal (/about)
  $locationProvider.html5Mode(true);
  // If we go to a URL that ui-router doesn't have registered, go to the "/" url.
  $urlRouterProvider.otherwise('/');
  // Trigger page refresh when accessing an OAuth route
  $urlRouterProvider.when('/auth/:provider', function () {
    window.location.reload();
  });
});

// This app.run is for controlling access to specific states.
app.run(function ($rootScope, AuthService, $state) {

  // The given state requires an authenticated user.
  var destinationStateRequiresAuth = function destinationStateRequiresAuth(state) {
    return state.data && state.data.authenticate;
  };

  // $stateChangeStart is an event fired
  // whenever the process of changing a state begins.
  $rootScope.$on('$stateChangeStart', function (event, toState, toParams) {

    if (!destinationStateRequiresAuth(toState)) {
      // The destination state does not require authentication
      // Short circuit with return.
      return;
    }

    if (AuthService.isAuthenticated()) {
      // The user is authenticated.
      // Short circuit with return.
      return;
    }

    // Cancel navigating to new state.
    event.preventDefault();

    AuthService.getLoggedInUser().then(function (user) {
      // If a user is retrieved, then renavigate to the destination
      // (the second time, AuthService.isAuthenticated() will work)
      // otherwise, if no user is logged in, go to "login" state.
      if (user) {
        $state.go(toState.name, toParams);
      } else {
        $state.go('login');
      }
    });
  });
});

app.filter('oAuthFilter', function () {
  return function (input) {
    input = input.trim().toLowerCase();
    if (input === 'google') return 'google-plus';else return input;
  };
});

app.config(function ($stateProvider) {

  $stateProvider.state('admin', {
    url: '/admin',
    templateUrl: 'js/adminPanel/templates/admin.html',
    controller: function controller() {},
    resolve: {
      isAdmin: function isAdmin($state, AuthService) {
        return AuthService.getLoggedInUser().then(function (user) {
          if (!user || user.isAdmin === false) $state.go('home');
        });
      }
    }
  });

  $stateProvider.state('admin.topics', {
    url: '/topics',
    templateUrl: 'js/adminPanel/templates/topics.html',
    controller: function controller($scope, topics, TopicFactory, FlagFactory, PrereqFactory, $uibModal) {

      $scope.topics = topics;

      $scope.update = TopicFactory.updateTopic;

      $scope.delete = function (id) {
        TopicFactory.deleteTopic(id).then(function (updatedTopics) {
          return $scope.topics = updatedTopics;
        });
      };

      //passing in topic id and prereq id
      $scope.deletePrereq = function (topicId, prereqId) {
        PrereqFactory.removeRelationship(topicId, prereqId).then();
      };

      //passing ids in opposite orders to delete a subsequent relationship
      $scope.deleteSubseq = function (topicId, subseqId) {
        PrereqFactory.removeRelationship(subseqId, topicId).then();
      };

      $scope.openFlags = function (topicId) {

        FlagFactory.fetchTopicFlags(topicId).then(function (topicFlags) {
          return $scope.flags = topicFlags;
        });

        $uibModal.open({
          animation: $scope.animationsEnabled,
          scope: $scope,
          templateUrl: './js/common/modals/views/topicFlagModal.html',
          controller: 'ModalInstanceCtrl'
        });
      };
    },
    resolve: {
      topics: function topics(TopicFactory) {
        return TopicFactory.fetchAll()
        // returns topics with the prereqs and subseqs on it
        .then(function (allTopics) {
          return Promise.all(allTopics.map(function (elem) {
            return TopicFactory.fetchById(elem.id);
          }));
        });
      }
    }
  });

  $stateProvider.state('admin.resources', {
    url: '/resources',
    templateUrl: 'js/adminPanel/templates/resources.html',
    controller: function controller($scope, resources, ResourceFactory, FlagFactory, $uibModal) {

      $scope.resources = resources;

      $scope.update = ResourceFactory.updateResource;

      $scope.types = ['article', 'video', 'book', 'documentation', 'tutorial', 'other'];

      $scope.flagType = 'resource';

      $scope.delete = function (id) {
        ResourceFactory.deleteResource(id).then(function (updatedResources) {
          return $scope.resources = updatedResources;
        });
      };

      $scope.openFlags = function (resourceId) {

        FlagFactory.fetchResourceFlags(resourceId).then(function (updatedResourceFlags) {
          return $scope.flags = updatedResourceFlags;
        });

        $uibModal.open({
          animation: $scope.animationsEnabled,
          scope: $scope,
          templateUrl: './js/common/modals/views/topicFlagModal.html',
          controller: 'ModalInstanceCtrl'
        });
      };
    },
    resolve: {
      resources: function resources(ResourceFactory) {
        return ResourceFactory.fetchAll();
      }
    }

  });
});

(function () {

  'use strict';

  // Hope you didn't forget Angular! Duh-doy.

  if (!window.angular) throw new Error('I can\'t find Angular!');

  var app = angular.module('fsaPreBuilt', []);

  app.factory('Socket', function () {
    if (!window.io) throw new Error('socket.io not found!');
    return window.io(window.location.origin);
  });

  // AUTH_EVENTS is used throughout our app to
  // broadcast and listen from and to the $rootScope
  // for important events about authentication flow.
  app.constant('AUTH_EVENTS', {
    loginSuccess: 'auth-login-success',
    loginFailed: 'auth-login-failed',
    logoutSuccess: 'auth-logout-success',
    sessionTimeout: 'auth-session-timeout',
    notAuthenticated: 'auth-not-authenticated',
    notAuthorized: 'auth-not-authorized'
  });

  app.factory('AuthInterceptor', function ($rootScope, $q, AUTH_EVENTS) {
    var statusDict = {
      401: AUTH_EVENTS.notAuthenticated,
      403: AUTH_EVENTS.notAuthorized,
      419: AUTH_EVENTS.sessionTimeout,
      440: AUTH_EVENTS.sessionTimeout
    };
    return {
      responseError: function responseError(response) {
        $rootScope.$broadcast(statusDict[response.status], response);
        return $q.reject(response);
      }
    };
  });

  app.config(function ($httpProvider) {
    $httpProvider.interceptors.push(['$injector', function ($injector) {
      return $injector.get('AuthInterceptor');
    }]);
  });

  app.service('AuthService', function ($http, Session, $rootScope, AUTH_EVENTS, $q) {

    function onSuccessfulLogin(response) {
      var data = response.data;
      Session.create(data.id, data.user);
      $rootScope.$broadcast(AUTH_EVENTS.loginSuccess);
      $rootScope.user = data.user;
      return data.user;
    }

    // Uses the session factory to see if an
    // authenticated user is currently registered.
    this.isAuthenticated = function () {
      return !!Session.user;
    };

    this.getLoggedInUser = function (fromServer) {

      // If an authenticated session exists, we
      // return the user attached to that session
      // with a promise. This ensures that we can
      // always interface with this method asynchronously.

      // Optionally, if true is given as the fromServer parameter,
      // then this cached value will not be used.

      if (this.isAuthenticated() && fromServer !== true) {
        return $q.when(Session.user);
      }

      // Make request GET /session.
      // If it returns a user, call onSuccessfulLogin with the response.
      // If it returns a 401 response, we catch it and instead resolve to null.
      return $http.get('/session').then(onSuccessfulLogin).catch(function () {
        return null;
      });
    };

    this.login = function (credentials) {
      return $http.post('/login', credentials).then(onSuccessfulLogin).catch(function () {
        return $q.reject({ message: 'Invalid login credentials.' });
      });
    };

    this.logout = function () {
      return $http.get('/logout').then(function () {
        Session.destroy();
        $rootScope.$broadcast(AUTH_EVENTS.logoutSuccess);
        $rootScope.user = null;
      });
    };
  });

  app.service('Session', function ($rootScope, AUTH_EVENTS) {

    var self = this;

    $rootScope.$on(AUTH_EVENTS.notAuthenticated, function () {
      self.destroy();
    });

    $rootScope.$on(AUTH_EVENTS.sessionTimeout, function () {
      self.destroy();
    });

    this.id = null;
    this.user = null;

    this.create = function (sessionId, user) {
      this.id = sessionId;
      this.user = user;
    };

    this.destroy = function () {
      this.id = null;
      this.user = null;
    };
  });
})();

app.config(function ($stateProvider) {
  $stateProvider.state('home', {
    url: '/',
    templateUrl: 'js/home/home.html',
    //setting controller for home
    controller: function controller($scope, topics, prereqs, TopicFactory) {
      $scope.topics = topics;
      $scope.prereqs = prereqs;
    },
    //resolving list of topics and prereqs to solve Async issue
    //list of topics and prereqs available on home html
    resolve: {
      topics: function topics(TopicFactory) {
        return TopicFactory.fetchAll();
      },
      prereqs: function prereqs(PrereqFactory) {
        return PrereqFactory.fetchAll();
      }
    }
  });
});
app.config(function ($stateProvider) {

  $stateProvider.state('login', {
    url: '/login',
    templateUrl: 'js/login/login.html',
    controller: 'LoginCtrl'
  });
});

app.controller('LoginCtrl', function ($scope, AuthService, $state) {

  $scope.login = {};
  $scope.error = null;

  $scope.sendLogin = function (loginInfo) {
    $scope.error = null;

    AuthService.login(loginInfo).then(function () {
      $state.go('home');
    }).catch(function () {
      $scope.error = 'Invalid login credentials.';
    });
  };
});
'use strict';

app.directive('oauthButton', function () {
  return {
    scope: {
      providerName: '@'
    },
    restrict: 'E',
    templateUrl: '/js/oauth/oauth-button.html'
  };
});

app.directive('oauth', function () {
  return {
    restrict: 'E',
    templateUrl: '/js/oauth/oauth.html'
  };
});
app.config(function ($stateProvider) {
  $stateProvider.state('plans', {
    url: '/plans',
    templateUrl: 'js/plans/plans.html',
    controller: 'PlansCtrl',
    resolve: {
      plans: function plans(PlanFactory, $rootScope, AuthService) {
        if (!$rootScope.user) {
          // necessary if a user reloads the plan page
          return AuthService.getLoggedInUser().then(function (user) {
            return PlanFactory.fetchPlansByUser(user.id);
          });
        } else {
          return PlanFactory.fetchPlansByUser($rootScope.user.id);
        }
      }
    }
  });
});

app.controller('PlansCtrl', function ($scope, PlanFactory, plans, $rootScope, $uibModal, TopicFactory, $state) {

  $scope.plans = plans;

  var userId;
  if ($rootScope.user) userId = $rootScope.user.id;

  $rootScope.$on('delete-plan', function (event, data) {
    PlanFactory.removePlan(data.planId).then(function () {
      return PlanFactory.fetchPlansByUser(userId);
    }).then(function (plans) {
      $scope.plans = plans;
    });
  });

  $scope.showPlan = function (planId) {
    $('#plan-nav-' + planId).siblings().removeClass('active');
    $('#plan-nav-' + planId).addClass('active');
    $scope.currentPlan = $scope.plans[getPlanById(planId)];
  };
  // show first plan by default
  if ($scope.plans.length > 0) $scope.showPlan($scope.plans[0].id);

  $scope.addNewPlan = function () {
    var addPlanModal = $uibModal.open({
      animation: true,
      templateUrl: './js/common/modals/views/addPlan.html',
      controller: 'AddPlanModalCtrl',
      resolve: {
        topics: function topics() {
          return TopicFactory.fetchAll();
        },
        options: {},
        resources: null
      }
    });
    addPlanModal.result.then(function (newPlan) {
      $scope.plans.push(newPlan);
    });
  };

  function getPlanById(id) {
    for (var i = 0; i < $scope.plans.length; i++) {
      if ($scope.plans[i].id === id) return i;
    }
  }

  // $scope.removePlan = function(id) {
  //     PlanFactory.removePlan(id).then(function() {
  //         return PlanFactory.fetchPlansByUser(userId)
  //     })
  //     .then(function(Plans) { $scope.userPlans = Plans; });
  // };
  //
  // $scope.removeFromPlan = function(planId, resourceId){
  //     PlanFactory.removeResourceFromPlan(planId, resourceId)
  //     .then(function(){
  //         return PlanFactory.fetchPlansByUser(userId)
  //     })
  //     .then(function(Plans){
  //         $scope.userPlans = Plans
  //     });
  // }
  //
  // $scope.moveUp = function(plan, resourceId){
  //     var rArr = plan.resources;
  //
  //     for(var i = 1; i < rArr.length; i++){
  //
  //           if(rArr[i].id === resourceId){
  //             var temp = rArr[i];
  //             rArr[i] = rArr[i-1];
  //             rArr[i-1] = temp;
  //           }
  //
  //     }
  // }
  //
  // $scope.moveDown = function(plan, resourceId){
  //     var rArr = plan.resources;
  //
  //     for(var i = 0; i < rArr.length-1; i++){
  //           if(rArr[i].id === resourceId){
  //             var temp = rArr[i];
  //             rArr[i] = rArr[i+1];
  //             rArr[i+1] = temp;
  //             break;
  //           }
  //     }
  // }
});

app.config(function ($stateProvider) {

  $stateProvider.state('signup', {
    url: '/signup',
    templateUrl: 'js/signup/signup.html',
    controller: 'SignupCtrl'
  });
});

app.controller('SignupCtrl', function ($scope, SignupFactory, $state) {
  $scope.error = null;
  $scope.signup = function () {
    SignupFactory.createUser($scope.newUser).then(function () {
      $state.go('home');
    }).catch(function (err) {
      $scope.error = err.data;
    });
  };
});

app.controller('TopicCtrl', function ($scope, $rootScope, $uibModal, $log, TopicFactory, topic, plans, votes) {
  $scope.topic = topic;
  $scope.topic.plans = plans;
  $scope.topic.votes = votes;
  sortAll();

  // get current user ID - used to determine whether a user has voted
  var userId;
  if ($rootScope.user) userId = $rootScope.user.id;
  // isLoggedIn = true is user is logged in; i.e., there is a user on the $rootScope
  $scope.isLoggedIn = userId >= 0;

  //split array of prereqTopics into smaller chunks of 3 and put them into these two arrays
  $scope.chunkPrereqs = [];
  $scope.chunkSubTops = [];

  function buildTopicChunks() {
    var size = 3;
    var preReqs = $scope.topic.prereqTopics.slice();
    var subTops = $scope.topic.subseqTopics.slice();
    var counter = 0;
    var topicsLeft = true;
    $scope.chunkPrereqs = [];
    $scope.chunkSubTops = [];

    while (preReqs.length || subTops.length) {
      if (preReqs.length) $scope.chunkPrereqs.push(preReqs.splice(0, size));
      if (subTops.length) $scope.chunkSubTops.push(subTops.splice(0, size));
    }
  }

  buildTopicChunks();

  // Suggest related topics (i.e., prerequisites or subsequent topics)
  $scope.suggestRelatedTopic = function (options) {
    if (options.suggestionType === 'prereq') {
      options.formTitle = "Add a prerequisite to " + $scope.topic.title;
    } else if (options.suggestionType === 'subseq') {
      options.formTitle = "Suggest a next topic for " + $scope.topic.title;
    }
    var suggestTopicModal = $uibModal.open({
      animation: true,
      templateUrl: 'js/common/modals/views/suggestTopic.html',
      controller: 'SuggestTopicModalCtrl',
      resolve: {
        options: options,
        topics: TopicFactory.fetchAll()
      }
    });

    suggestTopicModal.result.then(function (results) {
      var type = results[0],
          suggestedTopic = results[1];
      // update DOM
      if (type === 'prereq') {
        $scope.topic.prereqTopics.push(suggestedTopic);
      } else if (type === 'subseq') {
        $scope.topic.subseqTopics.push(suggestedTopic);
      }
      buildTopicChunks();
    });
  };

  // FLAGGING
  $scope.flagTopic = function (id) {
    $uibModal.open({
      animation: true,
      templateUrl: './js/common/modals/views/addFlagModal.html',
      controller: 'AddFlagModalInstanceCtrl',
      resolve: {
        options: { type: 'topic', id: id }
      }
    });
  };

  // ADD NEW RESOURCE
  $scope.addNewResource = function () {
    var addResourceModal = $uibModal.open({
      animation: true,
      templateUrl: './js/common/modals/views/addResource.html',
      controller: 'AddResourceModalCtrl',
      resolve: {
        options: { topicId: $scope.topic.id, topicName: $scope.topic.title }
      }
    });
    addResourceModal.result.then(function (newResource) {
      $scope.topic.resources.push(newResource);
    });
  };

  // ADD NEW PLAN
  $scope.addNewPlan = function () {
    var addPlanModal = $uibModal.open({
      animation: true,
      templateUrl: './js/common/modals/views/addPlan.html',
      controller: 'AddPlanModalCtrl',
      resolve: {
        options: { topicId: $scope.topic.id, topicName: $scope.topic.title },
        topics: null,
        resources: function resources() {
          return $scope.topic.resources;
        }
      }
    });
    addPlanModal.result.then(function (newPlan) {
      $scope.topic.plans.push(newPlan);
    });
  };

  $rootScope.$on('voted-need-resort', function (event, data) {

    $scope.topic.votes[data.type][data.id] = data.votes;
    sort(data.type);
    buildTopicChunks();
  });

  // DATA SORTING
  // Sort master routing function
  function sort(type) {
    switch (type) {
      case 'resources':
        $scope.topic.resources = TopicFactory.sortData($scope.topic.resources, $scope.topic.votes.resources, 'id');
        break;
      case 'prereq':
        $scope.topic.prereqTopics = TopicFactory.sortData($scope.topic.prereqTopics, $scope.topic.votes.prereq, 'prerequisiteId');
        break;
      case 'subseq':
        $scope.topic.subseqTopics = TopicFactory.sortData($scope.topic.subseqTopics, $scope.topic.votes.subseq, 'topicId');
        break;
    }
  }

  function sortAll() {
    sort('resources');
    sort('prereq');
    sort('subseq');
  }
});

app.config(function ($stateProvider) {

  $stateProvider.state('topic', {
    url: '/topic/:topicId',
    templateUrl: 'js/topics/topic.html',
    controller: 'TopicCtrl',
    resolve: {
      topic: function topic(TopicFactory, $stateParams) {
        return TopicFactory.fetchById($stateParams.topicId);
      },
      plans: function plans(PlanFactory, $stateParams) {
        return PlanFactory.fetchPlansByTopic($stateParams.topicId);
      },
      votes: function votes(VoteFactory, topic) {
        return VoteFactory.getProcessedVotes(topic);
      }
    }
  });
});

// State & Controller for all topics

app.config(function ($stateProvider) {

  $stateProvider.state('topics', {
    url: '/topics',
    templateUrl: 'js/topics/topics.html',
    controller: 'TopicsCtrl',
    params: { 'defaultSearch': null },
    resolve: {
      topics: function topics(TopicFactory) {
        return TopicFactory.fetchAll();
      }
    }
  });
});

app.controller('TopicsCtrl', function ($scope, TopicFactory, topics, $uibModal, $stateParams) {

  $scope.topics = topics;
  $scope.searchText = $stateParams.defaultSearch;

  // ADD TOPIC
  $scope.addTopic = function () {
    var addTopicModal = $uibModal.open({
      animation: true,
      templateUrl: './js/common/modals/views/addTopic.html',
      controller: 'AddTopicModalCtrl'
    });
    addTopicModal.result.then(function (newTopic) {
      $scope.topics.push(newTopic);
    });
  };
});

app.config(function ($stateProvider) {

  $stateProvider.state('userProfile', {
    url: '/user',
    templateUrl: 'js/userProfile/user-profile.html',
    controller: 'UserProfileCtrl',
    resolve: {
      currentUser: function currentUser(AuthService) {
        return AuthService.getLoggedInUser();
      },
      resources: ['currentUser', 'ResourceFactory', function (currentUser, ResourceFactory) {
        return ResourceFactory.fetchByUser(currentUser.id).then(function (resources) {
          return resources;
        });
      }]
    }
  });
});

app.controller('UserProfileCtrl', function ($scope, UsersFactory, PlanFactory, currentUser, resources) {

  function cloneObj(obj) {
    return Object.assign({}, obj);
  };

  $scope.error = null;
  $scope.pwUpdate = null;
  $scope.pwCheck = null;
  $scope.userUpdate = cloneObj(currentUser);
  $scope.resources = resources;
  $scope.updateUser = function (updatedInfo) {
    if ($scope.pwUpdate !== $scope.pwCheck) {
      $scope.error = "Password does not match confirmation!";
    } else {
      $scope.error = null;
      if ($scope.pwUpdate !== null) updatedInfo.password = $scope.pwUpdate;
      UsersFactory.updateUser(updatedInfo);
    }
  };

  $scope.reset = function () {
    $scope.userUpdate = cloneObj(currentUser);
    $scope.error = null;
    $scope.pwUpdate = null;
    $scope.pwCheck = null;
  };
});

app.config(function ($stateProvider) {

  $stateProvider.state('users', {
    url: '/users',
    templateUrl: 'js/users/templates/users.html'

  });
});

app.config(function ($stateProvider) {

  $stateProvider.state('admin.users', {
    url: '/users',
    templateUrl: 'js/users/templates/users.html',
    controller: function controller($scope, users, UsersFactory) {
      $scope.users = users;

      $scope.deleteUser = function (user) {
        UsersFactory.deleteUser(user).then(function (updatedUsers) {
          $scope.users = updatedUsers;
        });
      };

      $scope.triggerPasswordReset = function (user) {
        user.passwordReset = true;
        UsersFactory.updateUser(user);
      };

      $scope.update = UsersFactory.updateUser;
    },
    resolve: {
      users: function users(UsersFactory) {
        return UsersFactory.getAllUsers();
      }
    }

  });
});

app.factory('FlagFactory', function ($http) {
  var baseUrl = '/api/flags/';
  var obj = {
    fetchTopicFlags: function fetchTopicFlags(id) {
      return $http.get(baseUrl + 'topic/' + id).then(function (res) {
        return res.data;
      });
    },
    addTopicFlag: function addTopicFlag(id, flag) {
      return $http.post(baseUrl + 'topic/' + id, flag).then(function (res) {
        return res.data;
      }).catch(function (err) {
        return err.data;
      });
    },
    deleteTopicFlag: function deleteTopicFlag(flagId, topicId) {
      return $http.delete(baseUrl + 'topic/' + flagId).then(function () {
        return obj.fetchTopicFlags(topicId);
      });
    },
    fetchResourceFlags: function fetchResourceFlags(id) {
      return $http.get(baseUrl + 'resource/' + id).then(function (res) {
        return res.data;
      });
    },
    addResourceFlag: function addResourceFlag(id, flag) {
      return $http.post(baseUrl + 'resource/' + id, flag).then(function (res) {
        return res.data;
      }).catch(function (err) {
        return err.data;
      });
    },
    deleteResourceFlag: function deleteResourceFlag(flagId, resourceId) {
      return $http.delete(baseUrl + 'resource/' + flagId).then(function () {
        return obj.fetchResourceFlags(resourceId);
      });
    }

  };
  return obj;
});

app.factory('PlanFactory', function ($http) {

  var baseUrl = '/api/plans/';

  return {

    addNewPlan: function addNewPlan(name, description, topicId) {
      return $http.post(baseUrl, { name: name, description: description, topicId: topicId }).then(function (res) {
        return res.data;
      });
    },

    fetchPlansByTopic: function fetchPlansByTopic(topicId) {
      return $http.get(baseUrl + 'topic/' + topicId).then(function (res) {
        return res.data;
      });
    },

    addResourceToPlan: function addResourceToPlan(planId, resourceId) {
      return $http.post(baseUrl + planId + '/resource/' + resourceId).then(function (res) {
        return res.data;
      });
    },

    fetchResourcesByPlan: function fetchResourcesByPlan(planId) {
      return $http.get(baseUrl + planId + '/resources').then(function (res) {
        return res.data;
      });
    },

    fetchPlanById: function fetchPlanById(planId) {
      return $http.get(baseUrl + planId).then(function (res) {
        return res.data;
      });
    },

    fetchPlansByUser: function fetchPlansByUser(userid) {
      return $http.get(baseUrl + 'user/' + userid).then(function (res) {
        return res.data;
      });
    },

    removeResourceFromPlan: function removeResourceFromPlan(planId, resourceId) {
      return $http.delete(baseUrl + planId + '/resource/' + resourceId).then(function (res) {
        return res.data;
      });
    },

    removePlan: function removePlan(planId) {
      return $http.delete(baseUrl + planId).then(function (res) {
        return res.data;
      });
    }

  };
});

app.factory('PrereqFactory', function ($http) {

  var baseUrl = '/api/prerequisites/';

  return {

    fetchAll: function fetchAll() {
      return $http.get(baseUrl).then(function (res) {
        return res.data;
      });
    },

    removeRelationship: function removeRelationship(topicId, relationId) {
      return $http.delete(baseUrl + '/topic/' + topicId + '/prereq/' + relationId).then(function (res) {
        return res.data;
      });
    }

  };
});
app.factory('ResourceFactory', function ($http) {
  var baseUrl = '/api/resources/';
  var ResourceFactory = {};

  ResourceFactory.fetchAll = function () {
    return $http.get(baseUrl).then(function (res) {
      return res.data;
    });
  };

  ResourceFactory.fetchById = function (id) {
    return $http.get(baseUrl + id).then(function (res) {
      return res.data;
    });
  };

  ResourceFactory.fetchByUser = function (id) {
    return $http.get(baseUrl + 'user/' + id).then(function (res) {
      return res.data;
    });
  };

  ResourceFactory.updateResource = function (resource) {
    return $http.put(baseUrl + resource.id, resource).then(function (res) {
      return res.data;
    });
  };

  ResourceFactory.deleteResource = function (id) {
    return $http.delete(baseUrl + id).then(function () {
      return ResourceFactory.fetchAll();
    });
  };

  ResourceFactory.addTag = function (resourceId, tag) {
    return $http.post(baseUrl + resourceId + '/tag', { tagName: tag });
  };

  ResourceFactory.addNewResource = function (name, url, type, topicId) {
    return $http.post(baseUrl, { name: name, url: url, type: type, topicId: topicId }).then(function (res) {
      return res.data;
    });
  };

  return ResourceFactory;
});

app.factory('SignupFactory', function ($http) {
  var SignupFactory = {};

  SignupFactory.createUser = function (newUser) {
    return $http.post('/api/users', newUser).then(function (createdUser) {
      return createdUser.data;
    });
  };

  return SignupFactory;
});

app.factory('TopicFactory', function ($http) {

  var baseUrl = '/api/topics/';

  var obj = {

    fetchAll: function fetchAll() {
      return $http.get(baseUrl).then(function (res) {
        return res.data;
      });
    },

    fetchById: function fetchById(id) {
      return $http.get(baseUrl + id).then(function (res) {
        return res.data;
      });
    },

    addNewTopic: function addNewTopic(title, description) {
      return $http.post(baseUrl, { title: title, description: description }).then(function (res) {
        return res.data;
      });
    },

    updateTopic: function updateTopic(topic) {
      return $http.put(baseUrl + topic.id, topic).then(function (res) {
        return res.data;
      });
    },

    deleteTopic: function deleteTopic(id) {
      return $http.delete(baseUrl + id).then(function () {
        return obj.fetchAll();
      });
    },

    suggestTopic: function suggestTopic(type, topicId, newTopicName) {
      // convert to route format
      if (type === 'prereq') type = 'prerequisite';else if (type === 'subseq') type = 'subsequent';

      return $http.post(baseUrl + topicId + '/' + type, { title: newTopicName });
    },

    // Sorts voted data arrays - i.e., prerequisites, subsequent topics, and resources
    // -- dataArr = data array to be sorted
    // -- votes = $scope.numVotes object value to sort by
    // -- idKey = idKey on dataArr corresponding to the key in votes
    sortData: function sortData(dataArr, votes, idKey) {
      if (!votes) return dataArr; // if no votes found, do not sort

      function inOrder(index) {
        if (index === dataArr.length - 1) return true;
        var baseId = dataArr[index][idKey],
            nextId = dataArr[index + 1][idKey],
            numVotesBase = 0,
            numVotesNext = 0;
        if (votes[baseId]) numVotesBase = votes[baseId].length;
        if (votes[nextId]) numVotesNext = votes[nextId].length;
        return numVotesBase >= numVotesNext;
      }

      function swap(index) {
        var oldLeftValue = dataArr[index];
        dataArr[index] = dataArr[index + 1];
        dataArr[index + 1] = oldLeftValue;
      }

      var sorted = false;
      for (var end = dataArr.length; end > 0 && !sorted; end--) {
        sorted = true;
        for (var j = 0; j < end; j++) {
          if (!inOrder(j)) {
            swap(j);
            sorted = false;
          }
        }
      }
      return dataArr;
    }

  };
  return obj;
});

'use strict';

app.factory('UsersFactory', function ($http) {

  var obj = {};

  var baseUrl = '/api/users/';

  var getData = function getData(res) {
    return res.data;
  };

  obj.getAllUsers = function () {
    return $http.get(baseUrl).then(getData);
  };

  obj.deleteUser = function (user) {
    return $http.delete(baseUrl + user.id).then(function () {
      return obj.getAllUsers();
    });
  };

  obj.updateUser = function (user) {
    return $http.put(baseUrl + user.id, user);
  };

  obj.getById = function (id) {
    return $http.get(baseUrl + id).then(getData);
  };

  return obj;
});

app.factory('VoteFactory', function ($http, $q) {

  var upvotePath = '/api/upvote/';

  var VoteFactory = {};

  // Returns array of existing votes for all resources
  // -- Takes an array of resource IDs to pull votes for
  // -- If omitted, pulls all votes
  VoteFactory.fetchResourceVotes = function (resourceIds) {
    return $http.get(upvotePath + 'resource', { params: { resourceIds: resourceIds } }).then(function (res) {
      return res.data;
    });
  };

  // Returns array of existing votes for all prerequisites of a topic
  VoteFactory.fetchPrereqVotes = function (topicId) {
    return $http.get(upvotePath + 'relationship', { params: { topicId: topicId } }).then(function (res) {
      return res.data;
    });
  };

  // Returns array of existing votes for all prerequisites of a topic
  VoteFactory.fetchSubseqVotes = function (topicId) {
    return $http.get(upvotePath + 'relationship', { params: { prerequisiteId: topicId } }).then(function (res) {
      return res.data;
    });
  };

  VoteFactory.getProcessedVotes = function (topic) {
    return $q.all([VoteFactory.fetchResourceVotes(topic.resources.map(function (resource) {
      return resource.id;
    })), VoteFactory.fetchPrereqVotes(topic.id), VoteFactory.fetchSubseqVotes(topic.id)]).then(function (dbVotes) {

      function processVotes(votes, idKey) {
        var processedVotes = {},
            key;
        votes.forEach(function (vote) {
          key = vote[idKey];
          if (!processedVotes[key]) processedVotes[key] = [];
          processedVotes[key].push(vote.userId);
        });
        return processedVotes;
      }

      return {
        resources: processVotes(dbVotes[0], 'resourceId'),
        prereq: processVotes(dbVotes[1], 'prerequisiteId'),
        subseq: processVotes(dbVotes[2], 'topicId')
      };
    });
  };

  // Resolves to true if the vote was successfully added
  // -- topicId is optional; only used for relationship voting
  VoteFactory.addVote = function (type, id, topicId) {
    var idObj = {},
        path = upvotePath;
    if (type === 'prereq') {
      idObj = {
        topicId: topicId,
        prerequisiteId: id
      };
      path += 'relationship';
    } else if (type === 'subseq') {
      idObj = {
        topicId: id,
        prerequisiteId: topicId
      };
      path += 'relationship';
    } else {
      idObj[type + 'Id'] = id;
      path += type;
    }
    return $http.post(path, idObj).then(function (res) {
      if (res.status === 201) return true;
      return false;
    });
  };

  // Resolves to true if the vote was successfully deleted
  // -- topicId is optional; only used for relationship voting
  VoteFactory.removeVote = function (type, id, topicId) {
    var path = upvotePath;
    if (type === 'prereq') {
      path += 'relationship/topic/' + topicId + '/prereq/' + id;
    } else if (type === 'subseq') {
      // the prereq of a subsequent topics = the current topic
      path += 'relationship/topic/' + id + '/prereq/' + topicId;
    } else {
      path += type + '/' + id;
    }
    return $http.delete(path).then(function (res) {
      if (res.status === 204) return true;
      return false;
    });
  };

  return VoteFactory;
});

app.controller('AddPlanModalCtrl', function ($scope, $uibModalInstance, options, PlanFactory, topics, resources, $q) {
  if (topics) $scope.topics = topics; // used for My Learning Plans => addTopic
  if (resources) $scope.resources = resources; // used for Topic => addPlan

  if (options.topicName) {
    $scope.formTitle = 'Add new plan for ' + options.topicName;
    var topicId = options.topicId;
    $scope.defaultName = 'My ' + options.topicName + ' learning plan';
    $scope.defaultDescription = 'I am learning ' + options.topicName + '.';
  } else {
    $scope.formTitle = 'Add new plan';
    $scope.defaultName = '';
    $scope.defaultDescription = '';
  }

  $scope.addPlan = function (plan) {
    if (!plan.topicId) plan.topicId = options.topicId;
    var newPlan;

    return PlanFactory.addNewPlan(plan.name, plan.description, plan.topicId).then(function (newDbPlan) {
      newPlan = newDbPlan;
      var resourceIds = [];
      for (var key in plan.resources) {
        if (plan.resources[key]) resourceIds.push(+key);
      }
      return $q.all(resourceIds.map(function (resourceId) {
        return PlanFactory.addResourceToPlan(newDbPlan.id, resourceId);
      })).then(function () {
        return PlanFactory.fetchPlanById(newDbPlan.id);
      });
    }).then(function (plan) {
      return $uibModalInstance.close(plan);
    });
  };

  $scope.submit = function () {
    $uibModalInstance.close();
  };

  $scope.close = function () {
    $uibModalInstance.dismiss('cancel');
  };
});

app.controller('AddResourceModalCtrl', function ($scope, $uibModalInstance, options, ResourceFactory) {
  $scope.formTitle = 'Add resource to ' + options.topicName;
  var topicId = options.topicId;

  $scope.addResource = function (resource) {
    return ResourceFactory.addNewResource(resource.name, resource.url, resource.type, topicId).then(function (newResource) {
      $uibModalInstance.close(newResource);
    });
  };

  $scope.submit = function () {
    $uibModalInstance.close();
  };

  $scope.close = function () {
    $uibModalInstance.dismiss('cancel');
  };
});

app.controller('AddResourceToPlanModalCtrl', function ($scope, $uibModal, $uibModalInstance, plans, resource, options, ResourceFactory, PlanFactory, topicId) {
  $scope.formTitle = 'Add \'' + resource.name + '\' to my learning plan';
  $scope.plans = plans.concat([{ name: '- create a new plan -', id: 0 }]); // adds a dummy plan to accomodate creation of a new one
  $scope.resource = resource;

  // newPlanName should only exist if 'create a new plan' was selected for selectedPlan
  $scope.addResourceToPlan = function (selectedPlan) {
    if (selectedPlan.new) {
      var description = 'My new learning plan.';
      return PlanFactory.addNewPlan(selectedPlan.new, description, topicId).then(function (newPlan) {
        return PlanFactory.addResourceToPlan(newPlan.id, $scope.resource.id);
      }).then(function (newResource) {
        $uibModalInstance.close(newResource);
      });
    } else {
      return PlanFactory.addResourceToPlan(selectedPlan.existing.id, $scope.resource.id).then(function (newResource) {
        $uibModalInstance.close(newResource);
      });
    }
  };

  $scope.submit = function () {
    $uibModalInstance.close();
  };

  $scope.close = function () {
    $uibModalInstance.dismiss('cancel');
  };
});

app.controller('AddTopicModalCtrl', function ($scope, $uibModalInstance, TopicFactory) {
  $scope.formTitle = 'Add new topic';

  $scope.addTopic = function (topic) {
    return TopicFactory.addNewTopic(topic.name, topic.description).then(function (newTopic) {
      $uibModalInstance.close(newTopic);
    });
  };

  $scope.submit = function () {
    $uibModalInstance.close();
  };

  $scope.close = function () {
    $uibModalInstance.dismiss('cancel');
  };
});

// for users to flag a modal
app.controller('AddFlagModalInstanceCtrl', function ($scope, $window, options, $uibModalInstance, FlagFactory) {
  $scope.reasons = ['Rude or Abusive', 'Spam', 'Duplicate'];

  if (options.type === 'resource') {
    $scope.reasons.push('Off-Topic');
    $scope.addFlag = "addResourceFlag";
    $scope.heading = 'Resource';
  } else {
    $scope.addFlag = "addTopicFlag";
    $scope.heading = 'Topic';
  }
  $scope.id = options.id;

  $scope.flagIt = function (flag) {

    FlagFactory[$scope.addFlag]($scope.id, flag).then(function (res) {
      if (res[0] === "Y") $window.alert(res);
      $uibModalInstance.close();
    });
  };

  $scope.cancel = function () {
    $uibModalInstance.dismiss('cancel');
  };
});

// for admins to view submitted flags for an associated resource/topic
app.controller('ModalInstanceCtrl', function ($scope, $uibModalInstance, FlagFactory) {

  $scope.heading = $scope.flagType ? 'Resource Flags' : 'Topic Flags';

  $scope.ok = function () {
    $uibModalInstance.close();
  };

  $scope.close = function () {
    $uibModalInstance.dismiss('cancel');
  };

  $scope.delete = function (flag) {
    var deleteFlag = $scope.flagType ? FlagFactory.deleteResourceFlag : FlagFactory.deleteTopicFlag;
    var modelId = $scope.flagType ? 'resourceId' : 'topicId';
    deleteFlag(flag.id, flag[modelId]).then(function (flags) {
      $scope.flags = flags;
    });
  };
});

app.controller('SuggestTopicModalCtrl', function ($scope, $uibModalInstance, options, topics, TopicFactory) {

  $scope.topics = topics;
  $scope.formTitle = options.formTitle;
  $scope.suggestionType = options.suggestionType;
  var topicId = options.topicId;

  // type = type of topic relationship (prereq or subseq)
  $scope.suggestTopic = function (type, newTopicName) {
    return TopicFactory.suggestTopic(type, topicId, newTopicName).then(function (res) {
      // returns to TopicCtrl with "fake" object representing the suggested topic object
      var returnObj = { title: newTopicName };
      if (type === 'prereq') {
        returnObj.prerequisiteId = res.data[0][0].prerequisiteId;
      } else if (type === 'subseq') {
        // subsequent topics are stored on a topics page where:
        // -- current topic = prereqTopic
        // -- prereqTopic = current topic's subsequent topic
        returnObj.topicId = res.data[0][0].topicId;
      }
      $uibModalInstance.close([type, returnObj]);
    });
  };

  $scope.submit = function () {
    $uibModalInstance.close();
  };

  $scope.close = function () {
    $uibModalInstance.dismiss('cancel');
  };
});

app.directive('capstoneLogo', function () {
  return {
    restrict: 'E',
    templateUrl: 'js/common/directives/capstone-logo/capstone-logo.html'
  };
});

app.directive('landing', function () {

  return {
    restrict: 'E',
    templateUrl: 'js/common/directives/landing/landing.html',
    scope: {
      topics: "=",
      prereqs: "="
    },
    controller: function controller($scope, $state, TopicFactory) {

      var width = window.innerWidth,
          height = window.innerHeight;

      //Initialize the color scale

      var color = d3.scale.category20();

      //Initialize the node size scale
      //Here we are mapping all resource lengths to node sizes:

      var nodeSize = d3.scale.linear();

      nodeSize.domain(d3.extent($scope.topics, function (d) {
        return d.resources.length;
      }));
      nodeSize.range([15, 50]);

      //Initialize the svg element, which will act as a container for our data visualization
      //.call(d3.behavior.zoom())- calling d3's zooming functionality
      //.on('zoom')- redrawing our graph when the zoom events happen
      //.append()- appending a (group) element, not sure why this is needed?

      var svg = d3.select("#home").append("div")
      // .classed("svg-container", true)
      .append("svg")
      //responsive SVG needs these 2 attributes and no width and height attr
      // .attr("preserveAspectRatio", "xMinYMin meet")
      // .attr("viewBox", "0 0 2000 1700")
      //class to make it responsive
      // .classed("svg-content-responsive", true)
      .attr("width", width).attr("height", height)
      //ZOOM DISABLED
      .call(d3.behavior.zoom().on("zoom", redraw)).append('g');

      function redraw() {
        svg.attr("transform", "translate(" + d3.event.translate + ")" + " scale(" + d3.event.scale + ")");
      }

      //----------------Force Layout Configuration-----------------//

      //Initialize d3's force layout
      //.charge()- negative values indicate repulsion, + values indicate attraction
      //.linkDistance()- the distance we desire between connected nodes.
      //.size()- size of the graph, need to make it responsive

      var force = d3.layout.force().charge(-600).linkDistance(200).size([width, height]);

      // Prevent pan functionality from overriding node drag functionality

      var drag = force.stop().drag().on("dragstart", function (d) {
        d3.event.sourceEvent.stopPropagation();
      });

      //Data set up for force graph links/nodes
      var data = {}; //used to reference the topics
      var dataLinks = []; //to store links("relationships")

      //creating key value pairs where the key is topic id, value is the whole topic object
      $scope.topics.forEach(function (elem) {
        data[elem.id] = elem;
      });

      //creating the array of links by pushing objects with a source, target and value(weight of lines)
      $scope.prereqs.forEach(function (elem) {
        dataLinks.push({ source: data[elem.topicId], target: data[elem.prerequisiteId], value: 1 });
      });

      //Setting up topics as the force graph nodes, and dataLinks as the links
      force.nodes($scope.topics).links(dataLinks).start();

      //------------Setting up the actual visual node and link elements------//

      var link = svg.selectAll(".link").data(dataLinks).enter().append("line") // creates lines
      .attr("class", "link") //gives links class so it can be selected
      .style("stroke", "black") //stroke color
      //thickness of links                        //scales line-widths
      .style("stroke-width", function (d) {
        return Math.sqrt(d.value);
      });

      var node = svg.selectAll("g.node").data($scope.topics).enter().append("g") //svg group element that will contain circle and text elements
      .attr("class", "node") // give it a class of node
      .call(force.drag) //lets you drag nodes around screen
      .on('dblclick', function (d) {
        $state.go('topic', { topicId: d.id });
      }) //event handler for going to that topic node's state
      .on('click', connectedNodes); //event handler added for highlighting connected nodes

      node.append("circle") //appending a circle to each group element
      .attr("r", function (d) {
        return nodeSize(d.resources.length);
      }).attr("id", function (d) {
        return d.title;
      }).style("fill", function (d) {
        return color(d.title);
      });

      node.append("text") //appending text to each group element
      .attr("text-anchor", "middle").attr("x", function (d) {
        return d.x;
      }).attr("y", function (d) {
        return d.y;
      }).text(function (d) {
        return d.title;
      });

      //------------Handle the tick/force-simulation event and update each nodes location---------//
      force.on("tick", function () {

        link.attr("x1", function (d) {
          return d.source.x;
        }).attr("y1", function (d) {
          return d.source.y;
        }).attr("x2", function (d) {
          return d.target.x;
        }).attr("y2", function (d) {
          return d.target.y;
        });

        var circle = d3.selectAll("circle").attr("cx", function (d) {
          return d.x;
        }).attr("cy", function (d) {
          return d.y;
        });

        d3.selectAll("text").attr("x", function (d) {
          return d.x;
        }).attr("y", function (d) {
          return d.y;
        });
      });

      //-----------------Highlighting connected nodes------------//

      //Toggle stores whether the highlighting is on
      var toggle = 0;

      //Create an array logging what is connected to what
      var linkedByIndex = {};
      for (var i = 0; i < $scope.topics.length; i++) {
        linkedByIndex[i + "," + i] = 1;
      };
      dataLinks.forEach(function (d) {
        linkedByIndex[d.source.index + "," + d.target.index] = 1;
      });

      //This function looks up whether a pair are neighbours
      function neighboring(a, b) {
        return linkedByIndex[a.index + "," + b.index];
      }

      function connectedNodes() {

        if (toggle == 0) {
          //Reduce the opacity of all but the neighbouring nodes
          var d = d3.select(this).node().__data__;
          node.style("opacity", function (o) {
            return neighboring(d, o) | neighboring(o, d) ? 1 : 0.1;
          });

          link.style("opacity", function (o) {
            return d.index == o.source.index | d.index == o.target.index ? 1 : 0.1;
          });

          //Reduce the op

          toggle = 1;
        } else {
          //Put them back to opacity=1
          node.style("opacity", 1);
          link.style("opacity", 1);
          toggle = 0;
        }
      }
    }
  };
});

app.directive('navbar', function ($rootScope, AuthService, AUTH_EVENTS, $state, TopicFactory) {

  return {
    restrict: 'E',
    scope: {},
    templateUrl: 'js/common/directives/navbar/navbar.html',
    link: function link(scope) {

      scope.items = [{ label: 'Topics', state: 'topics' }];

      TopicFactory.fetchAll().then(function (topics) {
        return scope.topics = topics;
      });

      scope.searchForTopic = function (searchTopicName) {
        $state.go('topics', { 'defaultSearch': searchTopicName });
        $('#search-dropdown').removeClass('open'); // close search bar
      };

      scope.user = null;

      scope.isLoggedIn = function () {
        return AuthService.isAuthenticated();
      };

      scope.logout = function () {
        AuthService.logout().then(function () {
          $state.go('home');
        });
      };

      var setUser = function setUser() {
        AuthService.getLoggedInUser().then(function (user) {
          scope.user = user;
        });
      };

      var removeUser = function removeUser() {
        scope.user = null;
      };

      setUser();

      $rootScope.$on(AUTH_EVENTS.loginSuccess, setUser);
      $rootScope.$on(AUTH_EVENTS.logoutSuccess, removeUser);
      $rootScope.$on(AUTH_EVENTS.sessionTimeout, removeUser);

      // function toggleSideBar() {
      //     var pageWrapper = $('#page-wrapper');
      //
      //     if (pageWrapper.hasClass('show-sidebar')) {
      //         // Do things on Nav Close
      //         pageWrapper.removeClass('show-sidebar');
      //     } else {
      //         // Do things on Nav Open
      //         pageWrapper.addClass('show-sidebar');
      //     }
      // }

      // $(function() {
      //   $('.toggle-sidebar').click(function() {
      //       toggleSideBar();
      //   });
      // });
    }

  };
});

app.directive('myPlan', function ($rootScope, PlanFactory) {
  return {
    restrict: 'E',
    scope: {
      plan: '='
    },
    templateUrl: 'js/common/directives/plans/my-plan.html',
    link: function link(scope, element, attributes) {

      var userId;
      if ($rootScope.user) userId = $rootScope.user.id;

      scope.moveUp = function (resourceId) {
        var idx = getResourceIdx(resourceId);
        swapResources(idx, idx - 1);
      };

      scope.moveDown = function (resourceId) {
        var idx = getResourceIdx(resourceId);
        swapResources(idx, idx + 1);
      };

      scope.removeFromPlan = function (resourceId) {
        var idx = getResourceIdx(resourceId);
        PlanFactory.removeResourceFromPlan(scope.plan.id, resourceId).then(function () {
          scope.plan.resources.splice(idx, 1);
        });
      };

      scope.deletePlan = function (planId) {
        $rootScope.$broadcast('delete-plan', {
          planId: planId
        });
        scope.plan = null;
      };

      function getResourceIdx(id) {
        for (var i = 0; i < scope.plan.resources.length; i++) {
          if (scope.plan.resources[i].id === id) return i;
        }
      }

      function swapResources(idx1, idx2) {
        var temp = scope.plan.resources[idx1];
        scope.plan.resources[idx1] = scope.plan.resources[idx2];
        scope.plan.resources[idx2] = temp;
      }
    }
  };
});

'use strict';

app.directive('searchBox', function (TopicFactory) {
  return {
    restrict: 'AEC',
    scope: {
      items: '=',
      prompt: '@',
      title: '@',
      description: '@',
      model: '='
    },
    templateUrl: '/js/common/directives/search-box/search-box.html',
    link: function link(scope) {
      TopicFactory.fetchAll().then(function (topics) {
        return scope.topics = topics;
      });
    }
  };
});

app.directive('relatedTopic', function (VoteFactory, $rootScope) {
  return {
    restrict: 'E',
    scope: {
      type: '=',
      topic: '=',
      baseTopicId: '=',
      votes: '='
    },
    templateUrl: 'js/common/directives/topics/related-topic.html',
    link: function link(scope) {
      var userId;
      if ($rootScope.user) userId = $rootScope.user.id;

      // this topic's ID is actually the 'prerequisite' ID on the topic passed to the directive
      // vote button should be on the left for subsequent; right for prerequisite voting
      if (scope.type === 'prereq') {
        scope.topicId = scope.topic.prerequisiteId;
        scope.buttonOnLeft = false;
      } else {
        scope.topicId = scope.topic.topicId;
        scope.buttonOnLeft = true;
      }

      // isLoggedIn = true is user is logged in; i.e., there is a user on the $rootScope
      scope.isLoggedIn = userId >= 0;

      // voted = true if user has voted on this resource
      if (scope.votes && scope.votes.indexOf(userId) >= 0) scope.voted = true;else scope.voted = false;

      // VOTING
      scope.upvote = function () {
        if (userId) {
          // user may upvote only if he/she is logged in
          VoteFactory.addVote(scope.type, scope.topicId, scope.baseTopicId).then(function (success) {
            if (success) {
              if (!scope.votes) scope.votes = []; // if there are no existing votes
              scope.votes.push(userId);
              scope.voted = true;
              callForSort();
            }
          });
        }
      };

      scope.devote = function () {
        if (userId) {
          // user may upvote only if he/she is logged in
          VoteFactory.removeVote(scope.type, scope.topicId, scope.baseTopicId).then(function (success) {
            if (success) {
              scope.votes.splice(scope.votes.indexOf(userId));
              scope.voted = false;
              callForSort();
            }
          });
        }
      };

      function callForSort() {
        $rootScope.$broadcast('voted-need-resort', {
          type: scope.type,
          id: scope.topicId,
          votes: scope.votes
        });
      }
    }
  };
});

app.directive('topicListing', function ($rootScope, PlanFactory) {
  return {
    restrict: 'E',
    scope: {
      topic: '='
    },
    templateUrl: 'js/common/directives/topics/topic-listing.html',
    link: function link(scope) {}
  };
});

app.directive('topicPlan', function ($rootScope) {
  return {
    restrict: 'E',
    scope: {
      plan: '=',
      topicId: '='
    },
    templateUrl: 'js/common/directives/topics/topic-plan.html',
    link: function link(scope) {

      var userId;
      if ($rootScope.user) userId = $rootScope.user.id;

      //available on html
      scope.userId = userId;

      // isLoggedIn = true is user is logged in; i.e., there is a user on the $rootScope
      scope.isLoggedIn = userId >= 0;

      scope.copyPlan = function () {
        // to implement => copies this plan to the user's plan
      };
    }
  };
});

app.directive('topicResource', function (AuthService, TopicFactory, VoteFactory, $rootScope, $uibModal, PlanFactory) {
  return {
    restrict: 'E',
    scope: {
      resource: '=',
      topicId: '=',
      votes: '='
    },
    templateUrl: 'js/common/directives/topics/topic-resource.html',
    link: function link(scope) {

      var userId;
      if ($rootScope.user) userId = $rootScope.user.id;

      // isLoggedIn = true is user is logged in; i.e., there is a user on the $rootScope
      scope.isLoggedIn = userId >= 0;

      // voted = true if user has voted on this resource
      if (scope.votes && scope.votes.indexOf(userId) >= 0) scope.voted = true;else scope.voted = false;

      // VOTING
      scope.upvote = function () {
        if (userId) {
          // user may upvote only if he/she is logged in
          VoteFactory.addVote('resource', scope.resource.id, scope.topicId).then(function (success) {
            if (success) {
              if (!scope.votes) scope.votes = []; // if there are no existing votes
              scope.votes.push(userId);
              scope.voted = true;
              callForSort();
            }
          });
        }
      };

      scope.devote = function () {
        if (userId) {
          // user may upvote only if he/she is logged in
          VoteFactory.removeVote('resource', scope.resource.id, scope.topicId).then(function (success) {
            if (success) {
              scope.votes.splice(scope.votes.indexOf(userId));
              scope.voted = false;
              callForSort();
            }
          });
        }
      };

      // PLANS
      // add existing resource to plan
      scope.addResourceToPlan = function () {
        $uibModal.open({
          animation: true,
          templateUrl: './js/common/modals/views/addResourceToPlan.html',
          controller: 'AddResourceToPlanModalCtrl',
          resolve: {
            topicId: scope.topicId,
            plans: PlanFactory.fetchPlansByUser(userId),
            resource: scope.resource,
            options: { topicId: scope.topicId }
          }
        });
      };

      // FLAGGING
      scope.flagResource = function (id) {
        $uibModal.open({
          animation: true,
          templateUrl: './js/common/modals/views/addFlagModal.html',
          controller: 'AddFlagModalInstanceCtrl',
          resolve: {
            options: { type: 'resource', id: id }
          }
        });
      };

      function callForSort() {
        $rootScope.$broadcast('voted-need-resort', {
          type: 'resources',
          id: scope.resource.id,
          votes: scope.votes
        });
      }
    }
  };
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsImFkbWluUGFuZWwvYWRtaW4uanMiLCJmc2EvZnNhLXByZS1idWlsdC5qcyIsImhvbWUvaG9tZS5qcyIsImxvZ2luL2xvZ2luLmpzIiwib2F1dGgvb2F1dGguanMiLCJwbGFucy9wbGFucy5qcyIsInNpZ251cC9zaWdudXAuanMiLCJ0b3BpY3MvdG9waWMuY29udHJvbGxlci5qcyIsInRvcGljcy90b3BpYy5zdGF0ZS5qcyIsInRvcGljcy90b3BpY3MuanMiLCJ1c2VyUHJvZmlsZS91c2VyLXByb2ZpbGUuanMiLCJ1c2Vycy91c2VyLXN0YXRlcy5qcyIsInVzZXJzL3VzZXJzLnN0YXRlcy5qcyIsImNvbW1vbi9mYWN0b3JpZXMvZmxhZy5mYWN0b3J5LmpzIiwiY29tbW9uL2ZhY3Rvcmllcy9wbGFuLmZhY3RvcnkuanMiLCJjb21tb24vZmFjdG9yaWVzL3ByZXJlcXVpc2l0ZXMuZmFjdG9yeS5qcyIsImNvbW1vbi9mYWN0b3JpZXMvcmVzb3VyY2UuZmFjdG9yeS5qcyIsImNvbW1vbi9mYWN0b3JpZXMvc2lnbnVwLmZhY3RvcnkuanMiLCJjb21tb24vZmFjdG9yaWVzL3RvcGljLmZhY3RvcnkuanMiLCJjb21tb24vZmFjdG9yaWVzL3VzZXJzLmZhY3RvcnkuanMiLCJjb21tb24vZmFjdG9yaWVzL3ZvdGUuZmFjdG9yeS5qcyIsImNvbW1vbi9tb2RhbHMvYWRkUGxhbi5qcyIsImNvbW1vbi9tb2RhbHMvYWRkUmVzb3VyY2UuanMiLCJjb21tb24vbW9kYWxzL2FkZFJlc291cmNlVG9QbGFuLmpzIiwiY29tbW9uL21vZGFscy9hZGRUb3BpYy5qcyIsImNvbW1vbi9tb2RhbHMvZmxhZ3MuanMiLCJjb21tb24vbW9kYWxzL3N1Z2dlc3RUb3BpYy5qcyIsImNvbW1vbi9kaXJlY3RpdmVzL2NhcHN0b25lLWxvZ28vY2Fwc3RvbmUtbG9nby5qcyIsImNvbW1vbi9kaXJlY3RpdmVzL2xhbmRpbmcvbGFuZGluZy5qcyIsImNvbW1vbi9kaXJlY3RpdmVzL25hdmJhci9uYXZiYXIuanMiLCJjb21tb24vZGlyZWN0aXZlcy9wbGFucy9teS1wbGFuLmpzIiwiY29tbW9uL2RpcmVjdGl2ZXMvc2VhcmNoLWJveC9zZWFyY2gtYm94LmpzIiwiY29tbW9uL2RpcmVjdGl2ZXMvdG9waWNzL3JlbGF0ZWQtdG9waWMuanMiLCJjb21tb24vZGlyZWN0aXZlcy90b3BpY3MvdG9waWMtbGlzdGluZy5qcyIsImNvbW1vbi9kaXJlY3RpdmVzL3RvcGljcy90b3BpYy1wbGFuLmpzIiwiY29tbW9uL2RpcmVjdGl2ZXMvdG9waWNzL3RvcGljLXJlc291cmNlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQUNBLE9BQUEsR0FBQSxHQUFBLFFBQUEsTUFBQSxDQUFBLGFBQUEsRUFBQSxDQUFBLGFBQUEsRUFBQSxXQUFBLEVBQUEsY0FBQSxFQUFBLFdBQUEsQ0FBQSxDQUFBOztBQUVBLElBQUEsTUFBQSxDQUFBLFVBQUEsa0JBQUEsRUFBQSxpQkFBQSxFQUFBOztBQUVBLG9CQUFBLFNBQUEsQ0FBQSxJQUFBOztBQUVBLHFCQUFBLFNBQUEsQ0FBQSxHQUFBOztBQUVBLHFCQUFBLElBQUEsQ0FBQSxpQkFBQSxFQUFBLFlBQUE7QUFDQSxXQUFBLFFBQUEsQ0FBQSxNQUFBO0FBQ0EsR0FGQTtBQUdBLENBVEE7OztBQVlBLElBQUEsR0FBQSxDQUFBLFVBQUEsVUFBQSxFQUFBLFdBQUEsRUFBQSxNQUFBLEVBQUE7OztBQUdBLE1BQUEsK0JBQUEsU0FBQSw0QkFBQSxDQUFBLEtBQUEsRUFBQTtBQUNBLFdBQUEsTUFBQSxJQUFBLElBQUEsTUFBQSxJQUFBLENBQUEsWUFBQTtBQUNBLEdBRkE7Ozs7QUFNQSxhQUFBLEdBQUEsQ0FBQSxtQkFBQSxFQUFBLFVBQUEsS0FBQSxFQUFBLE9BQUEsRUFBQSxRQUFBLEVBQUE7O0FBRUEsUUFBQSxDQUFBLDZCQUFBLE9BQUEsQ0FBQSxFQUFBOzs7QUFHQTtBQUNBOztBQUVBLFFBQUEsWUFBQSxlQUFBLEVBQUEsRUFBQTs7O0FBR0E7QUFDQTs7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VUFBQSxDQUFBLFlBQUEsWUFBQTtBQUNBLGlCQUFBLElBQUEsR0FBQSxLQUFBLElBQUE7QUFDQSxhQUFBLEtBQUEsSUFBQTtBQUNBOzs7O0FBSUEsU0FBQSxlQUFBLEdBQUEsWUFBQTtBQUNBLGFBQUEsQ0FBQSxDQUFBLFFBQUEsSUFBQTtBQUNBLEtBRkE7O0FBSUEsU0FBQSxlQUFBLEdBQUEsVUFBQSxVQUFBLEVBQUE7Ozs7Ozs7Ozs7QUFVQSxVQUFBLEtBQUEsZUFBQSxNQUFBLGVBQUEsSUFBQSxFQUFBO0FBQ0EsZUFBQSxHQUFBLElBQUEsQ0FBQSxRQUFBLElBQUEsQ0FBQTtBQUNBOzs7OztBQUtBLGFBQUEsTUFBQSxHQUFBLENBQUEsVUFBQSxFQUFBLElBQUEsQ0FBQSxpQkFBQSxFQUFBLEtBQUEsQ0FBQSxZQUFBO0FBQ0EsZUFBQSxJQUFBO0FBQ0EsT0FGQSxDQUFBO0FBSUEsS0FyQkE7O0FBdUJBLFNBQUEsS0FBQSxHQUFBLFVBQUEsV0FBQSxFQUFBO0FBQ0EsYUFBQSxNQUFBLElBQUEsQ0FBQSxRQUFBLEVBQUEsV0FBQSxFQUNBLElBREEsQ0FDQSxpQkFEQSxFQUVBLEtBRkEsQ0FFQSxZQUFBO0FBQ0EsZUFBQSxHQUFBLE1BQUEsQ0FBQSxFQUFBLFNBQUEsNEJBQUEsRUFBQSxDQUFBO0FBQ0EsT0FKQSxDQUFBO0FBS0EsS0FOQTs7QUFRQSxTQUFBLE1BQUEsR0FBQSxZQUFBO0FBQ0EsYUFBQSxNQUFBLEdBQUEsQ0FBQSxTQUFBLEVBQUEsSUFBQSxDQUFBLFlBQUE7QUFDQSxnQkFBQSxPQUFBO0FBQ0EsbUJBQUEsVUFBQSxDQUFBLFlBQUEsYUFBQTtBQUNBLG1CQUFBLElBQUEsR0FBQSxJQUFBO0FBQ0EsT0FKQSxDQUFBO0FBS0EsS0FOQTtBQVFBLEdBdkRBOztBQXlEQSxNQUFBLE9BQUEsQ0FBQSxTQUFBLEVBQUEsVUFBQSxVQUFBLEVBQUEsV0FBQSxFQUFBOztBQUVBLFFBQUEsT0FBQSxJQUFBOztBQUVBLGVBQUEsR0FBQSxDQUFBLFlBQUEsZ0JBQUEsRUFBQSxZQUFBO0FBQ0EsV0FBQSxP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QUEsRUFBQSxLQUFBLEVBQUE7QUFDQSxTQUFBLEtBQUEsR0FBQSxLQUFBO0FBQ0EsU0FBQSxLQUFBLENBQUEsS0FBQSxHQUFBLEtBQUE7QUFDQSxTQUFBLEtBQUEsQ0FBQSxLQUFBLEdBQUEsS0FBQTtBQUNBOzs7QUFHQSxNQUFBLE1BQUE7QUFDQSxNQUFBLFdBQUEsSUFBQSxFQUFBLFNBQUEsV0FBQSxJQUFBLENBQUEsRUFBQTs7QUFFQSxTQUFBLFVBQUEsR0FBQSxVQUFBLENBQUE7OztBQUdBLFNBQUEsWUFBQSxHQUFBLEVBQUE7QUFDQSxTQUFBLFlBQUEsR0FBQSxFQUFBOztBQUVBLFdBQUEsZ0JBQUEsR0FBQTtBQUNBLFFBQUEsT0FBQSxDQUFBO0FBQ0EsUUFBQSxVQUFBLE9BQUEsS0FBQSxDQUFBLFlBQUEsQ0FBQSxLQUFBLEVBQUE7QUFDQSxRQUFBLFVBQUEsT0FBQSxLQUFBLENBQUEsWUFBQSxDQUFBLEtBQUEsRUFBQTtBQUNBLFFBQUEsVUFBQSxDQUFBO0FBQ0EsUUFBQSxhQUFBLElBQUE7QUFDQSxXQUFBLFlBQUEsR0FBQSxFQUFBO0FBQ0EsV0FBQSxZQUFBLEdBQUEsRUFBQTs7QUFFQSxXQUFBLFFBQUEsTUFBQSxJQUFBLFFBQUEsTUFBQSxFQUFBO0FBQ0EsVUFBQSxRQUFBLE1BQUEsRUFBQSxPQUFBLFlBQUEsQ0FBQSxJQUFBLENBQUEsUUFBQSxNQUFBLENBQUEsQ0FBQSxFQUFBLElBQUEsQ0FBQTtBQUNBLFVBQUEsUUFBQSxNQUFBLEVBQUEsT0FBQSxZQUFBLENBQUEsSUFBQSxDQUFBLFFBQUEsTUFBQSxDQUFBLENBQUEsRUFBQSxJQUFBLENBQUE7QUFDQTtBQUVBOztBQUVBOzs7QUFLQSxTQUFBLG1CQUFBLEdBQUEsVUFBQSxPQUFBLEVBQUE7QUFDQSxRQUFBLFFBQUEsY0FBQSxLQUFBLFFBQUEsRUFBQTtBQUNBLGNBQUEsU0FBQSxHQUFBLDJCQUFBLE9BQUEsS0FBQSxDQUFBLEtBQUE7QUFDQSxLQUZBLE1BRUEsSUFBQSxRQUFBLGNBQUEsS0FBQSxRQUFBLEVBQUE7QUFDQSxjQUFBLFNBQUEsR0FBQSw4QkFBQSxPQUFBLEtBQUEsQ0FBQSxLQUFBO0FBQ0E7QUFDQSxRQUFBLG9CQUFBLFVBQUEsSUFBQSxDQUFBO0FBQ0EsaUJBQUEsSUFEQTtBQUVBLG1CQUFBLDBDQUZBO0FBR0Esa0JBQUEsdUJBSEE7QUFJQSxlQUFBO0FBQ0EsaUJBQUEsT0FEQTtBQUVBLGdCQUFBLGFBQUEsUUFBQTtBQUZBO0FBSkEsS0FBQSxDQUFBOztBQVVBLHNCQUFBLE1BQUEsQ0FDQSxJQURBLENBQ0EsVUFBQSxPQUFBLEVBQUE7QUFDQSxVQUFBLE9BQUEsUUFBQSxDQUFBLENBQUE7QUFBQSxVQUNBLGlCQUFBLFFBQUEsQ0FBQSxDQURBOztBQUdBLFVBQUEsU0FBQSxRQUFBLEVBQUE7QUFDQSxlQUFBLEtBQUEsQ0FBQSxZQUFBLENBQUEsSUFBQSxDQUFBLGNBQUE7QUFDQSxPQUZBLE1BRUEsSUFBQSxTQUFBLFFBQUEsRUFBQTtBQUNBLGVBQUEsS0FBQSxDQUFBLFlBQUEsQ0FBQSxJQUFBLENBQUEsY0FBQTtBQUNBO0FBQ0E7QUFDQSxLQVhBO0FBWUEsR0E1QkE7OztBQStCQSxTQUFBLFNBQUEsR0FBQSxVQUFBLEVBQUEsRUFBQTtBQUNBLGNBQUEsSUFBQSxDQUFBO0FBQ0EsaUJBQUEsSUFEQTtBQUVBLG1CQUFBLDRDQUZBO0FBR0Esa0JBQUEsMEJBSEE7QUFJQSxlQUFBO0FBQ0EsaUJBQUEsRUFBQSxNQUFBLE9BQUEsRUFBQSxJQUFBLEVBQUE7QUFEQTtBQUpBLEtBQUE7QUFRQSxHQVRBOzs7QUFZQSxTQUFBLGNBQUEsR0FBQSxZQUFBO0FBQ0EsUUFBQSxtQkFBQSxVQUFBLElBQUEsQ0FBQTtBQUNBLGlCQUFBLElBREE7QUFFQSxtQkFBQSwyQ0FGQTtBQUdBLGtCQUFBLHNCQUhBO0FBSUEsZUFBQTtBQUNBLGlCQUFBLEVBQUEsU0FBQSxPQUFBLEtBQUEsQ0FBQSxFQUFBLEVBQUEsV0FBQSxPQUFBLEtBQUEsQ0FBQSxLQUFBO0FBREE7QUFKQSxLQUFBLENBQUE7QUFRQSxxQkFBQSxNQUFBLENBQ0EsSUFEQSxDQUNBLFVBQUEsV0FBQSxFQUFBO0FBQ0EsYUFBQSxLQUFBLENBQUEsU0FBQSxDQUFBLElBQUEsQ0FBQSxXQUFBO0FBQ0EsS0FIQTtBQUlBLEdBYkE7OztBQWdCQSxTQUFBLFVBQUEsR0FBQSxZQUFBO0FBQ0EsUUFBQSxlQUFBLFVBQUEsSUFBQSxDQUFBO0FBQ0EsaUJBQUEsSUFEQTtBQUVBLG1CQUFBLHVDQUZBO0FBR0Esa0JBQUEsa0JBSEE7QUFJQSxlQUFBO0FBQ0EsaUJBQUEsRUFBQSxTQUFBLE9BQUEsS0FBQSxDQUFBLEVBQUEsRUFBQSxXQUFBLE9BQUEsS0FBQSxDQUFBLEtBQUEsRUFEQTtBQUVBLGdCQUFBLElBRkE7QUFHQSxtQkFBQSxxQkFBQTtBQUFBLGlCQUFBLE9BQUEsS0FBQSxDQUFBLFNBQUE7QUFBQTtBQUhBO0FBSkEsS0FBQSxDQUFBO0FBVUEsaUJBQUEsTUFBQSxDQUNBLElBREEsQ0FDQSxVQUFBLE9BQUEsRUFBQTtBQUNBLGFBQUEsS0FBQSxDQUFBLEtBQUEsQ0FBQSxJQUFBLENBQUEsT0FBQTtBQUNBLEtBSEE7QUFJQSxHQWZBOztBQWlCQSxhQUFBLEdBQUEsQ0FBQSxtQkFBQSxFQUFBLFVBQUEsS0FBQSxFQUFBLElBQUEsRUFBQTs7QUFFQSxXQUFBLEtBQUEsQ0FBQSxLQUFBLENBQUEsS0FBQSxJQUFBLEVBQUEsS0FBQSxFQUFBLElBQUEsS0FBQSxLQUFBO0FBQ0EsU0FBQSxLQUFBLElBQUE7QUFDQTtBQUVBLEdBTkE7Ozs7QUFVQSxXQUFBLElBQUEsQ0FBQSxJQUFBLEVBQUE7QUFDQSxZQUFBLElBQUE7QUFDQSxXQUFBLFdBQUE7QUFDQSxlQUFBLEtBQUEsQ0FBQSxTQUFBLEdBQUEsYUFBQSxRQUFBLENBQUEsT0FBQSxLQUFBLENBQUEsU0FBQSxFQUFBLE9BQUEsS0FBQSxDQUFBLEtBQUEsQ0FBQSxTQUFBLEVBQUEsSUFBQSxDQUFBO0FBQ0E7QUFDQSxXQUFBLFFBQUE7QUFDQSxlQUFBLEtBQUEsQ0FBQSxZQUFBLEdBQUEsYUFBQSxRQUFBLENBQUEsT0FBQSxLQUFBLENBQUEs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T0FBQSxNQUFBLENBQUEsRUFBQSxFQUFBLEdBQUEsQ0FBQTtBQUFBOztBQUVBLFNBQUEsS0FBQSxHQUFBLElBQUE7QUFDQSxTQUFBLFFBQUEsR0FBQSxJQUFBO0FBQ0EsU0FBQSxPQUFBLEdBQUEsSUFBQTtBQUNBLFNBQUEsVUFBQSxHQUFBLFNBQUEsV0FBQSxDQUFBO0FBQ0EsU0FBQSxTQUFBLEdBQUEsU0FBQTtBQUNBLFNBQUEsVUFBQSxHQUFBLFVBQUEsV0FBQSxFQUFBO0FBQ0EsUUFBQSxPQUFBLFFBQUEsS0FBQSxPQUFBLE9BQUEsRUFBQTtBQUNBLGFBQUEsS0FBQSxHQUFBLHVDQUFBO0FBQ0EsS0FGQSxNQUdBO0FBQ0EsYUFBQSxLQUFBLEdBQUEsSUFBQTtBQUNBLFVBQUEsT0FBQSxRQUFBLEtBQUEsSUFBQSxFQUFBLFlBQUEsUUFBQSxHQUFBLE9BQUEsUUFBQTtBQUNBLG1CQUFBLFVBQUEsQ0FBQSxXQUFBO0FBQ0E7QUFDQSxHQVRBOztBQVdBLFNBQUEsS0FBQSxHQUFBLFlBQUE7QUFDQSxXQUFBLFVBQUEsR0FBQSxTQUFBLFdBQUEsQ0FBQTtBQUNBLFdBQUEsS0FBQSxHQUFBLElBQUE7QUFDQSxXQUFBLFFBQUEsR0FBQSxJQUFBO0FBQ0EsV0FBQSxPQUFBLEdBQUEsSUFBQTtBQUNBLEdBTEE7QUFPQSxDQTNCQTs7QUNsQkEsSUFBQSxNQUFBLENBQUEsVUFBQSxjQUFBLEVBQUE7O0FBRUEsaUJBQUEsS0FBQSxDQUFBLE9BQUEsRUFBQTtBQUNBLFNBQUEsUUFEQTtBQUVBLGlCQUFBOztBQUZBLEdBQUE7QUFNQSxDQVJBOztBQ0NBLElBQUEsTUFBQSxDQUFBLFVBQUEsY0FBQSxFQUFBOztBQUVBLGlCQUFBLEtBQUEsQ0FBQSxhQUFBLEVBQUE7QUFDQSxTQUFBLFFBREE7QUFFQSxpQkFBQSwrQkFGQTtBQUdBLGdCQUFBLG9CQUFBLE1BQUEsRUFBQSxLQUFBLEVBQUEsWUFBQSxFQUFBO0FBQ0EsYUFBQSxLQUFBLEdBQUEsS0FBQTs7QUFFQSxhQUFBLFVBQUEsR0FBQSxVQUFBLElBQUEsRUFBQTtB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SUFEQSxDQUNBO0FBQUEsYUFBQSxJQUFBLElBQUE7QUFBQSxLQURBLENBQUE7QUFFQSxHQUhBOztBQUtBLGtCQUFBLGNBQUEsR0FBQSxVQUFBLEVBQUEsRUFBQTtBQUNBLFdBQUEsTUFBQSxNQUFBLENBQUEsVUFBQSxFQUFBLEVBQ0EsSUFEQSxDQUNBLFlBQUE7QUFBQSxhQUFBLGdCQUFBLFFBQUEsRUFBQTtBQUFBLEtBREEsQ0FBQTtBQUVBLEdBSEE7O0FBS0Esa0JBQUEsTUFBQSxHQUFBLFVBQUEsVUFBQSxFQUFBLEdBQUEsRUFBQTtBQUNBLFdBQUEsTUFBQSxJQUFBLENBQUEsVUFBQSxVQUFBLEdBQUEsTUFBQSxFQUFBLEVBQUEsU0FBQSxHQUFBLEVBQUEsQ0FBQTtBQUNBLEdBRkE7O0FBSUEsa0JBQUEsY0FBQSxHQUFBLFVBQUEsSUFBQSxFQUFBLEdBQUEsRUFBQSxJQUFBLEVBQUEsT0FBQSxFQUFBO0FBQ0EsV0FBQSxNQUFBLElBQUEsQ0FBQSxPQUFBLEVBQUEsRUFBQSxNQUFBLElBQUEsRUFBQSxLQUFBLEdBQUEsRUFBQSxNQUFBLElBQUEsRUFBQSxTQUFBLE9BQUEsRUFBQSxFQUNBLElBREEsQ0FDQTtBQUFBLGFBQUEsSUFBQSxJQUFBO0FBQUEsS0FEQSxDQUFBO0FBRUEsR0FIQTs7QUFLQSxTQUFBLGVBQUE7QUFFQSxDQXhDQTs7QUNBQSxJQUFBLE9BQUEsQ0FBQSxlQUFBLEVBQUEsVUFBQSxLQUFBLEVBQUE7QUFDQSxNQUFBLGdCQUFBLEVBQUE7O0FBRUEsZ0JBQUEsVUFBQSxHQUFBLFVBQUEsT0FBQSxFQUFBO0FBQ0EsV0FBQSxNQUFBLElBQUEsQ0FBQSxZQUFBLEVBQUEsT0FBQSxFQUNBLElBREEsQ0FDQSxVQUFBLFdBQUEsRUFBQTtBQUNBLGFBQUEsWUFBQSxJQUFBO0FBQ0EsS0FIQSxDQUFBO0FBSUEsR0FMQTs7QUFPQSxTQUFBLGFBQUE7QUFDQSxDQVhBOztBQ0FBLElBQUEsT0FBQSxDQUFBLGNBQUEsRUFBQSxVQUFBLEtBQUEsRUFBQTs7QUFFQSxNQUFBLFVBQUEsY0FBQTs7QUFF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Q0FBQSxjQUFBLEVBQUEsVUFBQSxLQUFBLEVBQUE7O0FBRUEsTUFBQSxNQUFBLEVBQUE7O0FBRUEsTUFBQSxVQUFBLGFBQUE7O0FBRUEsTUFBQSxVQUFBLFNBQUEsT0FBQTtBQUFBLFdBQUEsSUFBQSxJQUFBO0FBQUEsR0FBQTs7QUFFQSxNQUFBLFdBQUEsR0FBQTtBQUFBLFdBQUEsTUFBQSxHQUFBLENBQUEsT0FBQSxFQUFBLElBQUEsQ0FBQSxPQUFBLENBQUE7QUFBQSxHQUFBOztBQUVBLE1BQUEsVUFBQSxHQUFBO0FBQUEsV0FBQSxNQUFBLE1BQUEsQ0FBQSxVQUFBLEtBQUEsRUFBQSxFQUFBLElBQUEsQ0FBQTtBQUFBLGFBQUEsSUFBQSxXQUFBLEVBQUE7QUFBQSxLQUFBLENBQUE7QUFBQSxHQUFBOztBQUVBLE1BQUEsVUFBQSxHQUFBO0FBQUEsV0FBQSxNQUFBLEdBQUEsQ0FBQSxVQUFBLEtBQUEsRUFBQSxFQUFBLElBQUEsQ0FBQTtBQUFBLEdBQUE7O0FBRUEsTUFBQSxPQUFBLEdBQUE7QUFBQSxXQUFBLE1BQUEsR0FBQSxDQUFBLFVBQUEsRUFBQSxFQUFBLElBQUEsQ0FBQSxPQUFBLENBQUE7QUFBQSxHQUFBOztBQUVBLFNBQUEsR0FBQTtBQUVBLENBbEJBOztBQ0ZBLElBQUEsT0FBQSxDQUFBLGFBQUEsRUFBQSxVQUFBLEtBQUEsRUFBQSxFQUFBLEVBQUE7O0FBRUEsTUFBQSxhQUFBLGNBQUE7O0FBRUEsTUFBQSxjQUFBLEVBQUE7Ozs7O0FBS0EsY0FBQSxrQkFBQSxHQUFBLFVBQUEsV0FBQSxFQUFBO0FBQ0EsV0FBQSxNQUFBLEdBQUEsQ0FBQSxhQUFBLFVBQUEsRUFBQSxFQUFBLFFBQUEsRUFBQSx3QkFBQSxFQUFBLEVBQUEsRUFDQSxJQURBLENBQ0E7QUFBQSxhQUFBLElBQUEsSUFBQTtBQUFBLEtBREEsQ0FBQTtBQUVBLEdBSEE7OztBQU1BLGNBQUEsZ0JBQUEsR0FBQSxVQUFBLE9BQUEsRUFBQTtBQUNBLFdBQUEsTUFBQSxHQUFBLENBQUEsYUFBQSxjQUFBLEVBQUEsRUFBQSxRQUFBLEVBQUEsZ0JBQUEsRUFBQSxFQUFBLEVBQ0EsSUFEQSxDQUNBO0FBQUEsYUFBQSxJQUFBLElBQUE7QUFBQSxLQURBLENBQUE7QUFFQSxHQUhBOzs7QUFNQSxjQUFBLGdCQUFBLEdBQUEsVUFBQSxPQUFBLEVBQUE7QUFDQSxXQUFBLE1BQUEsR0FBQSxDQUFBLGFBQUEsY0FBQSxFQUFBLEVBQUEsUUFBQSxFQUFBLGdCQUFBLE9BQUEsRUFBQSxFQUFBLEVBQ0EsSUFEQSxDQUNBO0FBQUEsYUFBQSxJQUFBLElBQUE7QUFBQSxLQURBLENBQUE7QUFFQSxHQUhBOztBQUtBLGNBQUEsaUJBQUEsR0FBQSxVQUFBLEtBQUEsRUFBQTtBQUNBLFdBQUEsR0FBQSxHQUFBLENBQUEsQ0FDQSxZQUFBLGtCQUFBLENBQ0EsTUFBQSxTQUFBLENBQUEsR0FBQSxDQUFBLFVBQUEsUUFBQSxFQUFBO0FBQ0EsYUFBQSxTQUFBLEVBQUE7QUFDQSxLQUZBLENBREEsQ0FEQSxFQUtBLFlBQUEsZ0JBQUEsQ0FBQSxNQUFBLEVBQUEsQ0FMQSxFQU1BLFlBQUEsZ0JBQUEsQ0FBQSxNQUFBLEVBQUEsQ0FOQSxDQUFBLEVBUUEsSUFSQSxDQVFBLFVBQUEsT0FBQSxFQUFBOztBQUVBLGVBQUEsWUFBQSxDQUFBLEtBQUEsRUFBQSxLQUFBLEVBQUE7QUFDQSxZQUFBLGlCQUFBLEVBQUE7QUFBQSxZQUFBLEdBQUE7QUFDQSxjQUFBLE9BQUEsQ0FBQSxVQUFBLElBQUEsRUFBQTtBQUNBLGdCQUFBLEtBQUEsS0FBQSxDQUFBO0FBQ0EsY0FBQSxDQUFBLGVBQUEsR0FBQSxDQUFBLEVBQUEsZUFBQSxHQUFBLElBQUEsRUFBQTtBQUNBLHlCQUFBLEdBQUEsRUFBQSxJQUFBLENBQUEsS0FBQSxNQUFBO0FBQ0EsU0FKQTtBQUtBLGVBQUEsY0FBQTtBQUNBOztBQUVBLGFBQUE7QUFDQSxtQkFBQSxhQUFBLFFBQUEsQ0FBQSxDQUFBLEVBQUEsWUFBQSxDQURBO0FBRUEsZ0JBQUEsYUFBQSxRQUFBLENBQUEsQ0FBQSxFQUFBLGdCQUFBLENBRkE7QUFHQSxnQkFBQSxhQUFBLFFBQUEsQ0FBQSxDQUFBLEVBQUEsU0FBQTtBQUhBLE9BQUE7QUFNQSxLQTFCQSxDQUFBO0FBMkJBLEdBNUJBOzs7O0FBaUNBLGNBQUEsT0FBQSxHQUFBLFVBQUEsSUFBQSxFQUFBLEVBQUEsRUFBQSxPQUFBLEVBQUE7QUFDQSxRQUFBLFFBQUEsRUFBQTtBQUFBLFFBQ0EsT0FBQSxVQURBO0FBRUEsUUFBQSxTQUFBLFFBQUEsRUFBQTtBQUNBLGNBQUE7QUFDQSxpQkFBQSxPQURBO0FBRUEsd0JBQUE7QUFGQSxPQUFBO0FBSUEsY0FBQSxjQUFBO0FBQ0EsS0FOQSxNQU1BLElBQUEsU0FBQSxRQUFBLEVBQUE7QUFDQSxjQUFBO0FBQ0EsaUJBQUEsRUFEQTtBQUVBLHdCQUFBO0FBRkEsT0FBQTtBQUlBLGNBQUEsY0FBQTtBQUNBLEtBTkEsTUFNQTtBQUNBLFlBQUEsT0FBQSxJQUFBLElBQUEsRUFBQTtBQUNBLGNBQUEsSUFBQTtBQUNBO0FBQ0EsV0FBQSxNQUFBLElBQUEsQ0FBQSxJQUFBLEVBQUEsS0FBQSxFQUNBLElBREEsQ0FDQSxVQUFBLEdBQUEsRUFBQTtBQUNBLFVBQUEsSUFBQSxNQUFBLEtBQUEsR0FBQSxFQUFBLE9BQUEsSUFBQTtBQUNBLGFBQUEsS0FBQTtBQUNBLEtBSkEsQ0FBQTtBQUtBLEdBeEJBOzs7O0FBNEJBLGNBQUEsVUFBQSxHQUFBLFVBQUEsSUFBQSxFQUFBLEVBQUEsRUFBQSxPQUFBLEVBQUE7QUFDQSxRQUFBLE9BQUEsVUFBQTtBQUNBLFFBQUEsU0FBQSxRQUFBLEVBQUE7QUFDQSxjQUFBLHdCQUFBLE9BQUEsR0FBQSxVQUFBLEdBQUEsRUFBQTtBQUNBLEtBRkEsTUFFQSxJQUFBLFNBQUEsUUFBQSxFQUFBOztBQUVBLGNBQUEsd0JBQUEsRUFBQSxHQUFBLFVBQUEsR0FBQSxPQUFBO0FBQ0EsS0FIQSxNQUdBO0FBQ0EsY0FBQSxPQUFBLEdBQUEsR0FBQSxFQUFBO0FBQ0E7QUFDQSxXQUFBLE1BQUEsTUFBQSxDQUFBLElBQUEsRUFDQSxJQURBLENBQ0EsVUFBQSxHQUFBLEVBQUE7QUFDQSxVQUFBLElBQUEsTUFBQSxLQUFBLEdBQUEsRUFBQSxPQUFBLElBQUE7QUFDQSxhQUFBLEtBQUE7QUFDQSxLQUpBLENBQUE7QUFLQSxHQWZBOztBQWtCQSxTQUFBLFdBQUE7QUFFQSxDQTNHQTs7QUNBQSxJQUFBLFVBQUEsQ0FBQSxrQkFBQSxFQUFBLFVBQUEsTUFBQSxFQUFBLGlCQUFBLEVBQUEsT0FBQSxFQUFBLFdBQUEsRUFBQSxNQUFBLEVBQUEsU0FBQSxFQUFBLEVBQUEsRUFBQTtBQUNBLE1BQUEsTUFBQSxFQUFBLE9BQUEsTUFBQSxHQUFBLE1BQUEsQztBQUNBLE1BQUEsU0FBQSxFQUFBLE9BQUEsU0FBQSxHQUFBLFNBQUEsQzs7QUFFQSxNQUFBLFFBQUEsU0FBQSxFQUFBO0FBQ0EsV0FBQSxTQUFBLEdBQUEsc0JBQUEsUUFBQSxTQUFBO0FBQ0EsUUFBQSxVQUFBLFFBQUEsT0FBQTtBQUNBLFdBQUEsV0FBQSxHQUFBLFFBQUEsUUFBQSxTQUFBLEdBQUEsZ0JBQUE7QUFDQSxXQUFBLGtCQUFBLEdBQUEsbUJBQUEsUUFBQSxTQUFBLEdBQUEsR0FBQTtBQUNBLEdBTEEsTUFLQTtBQUNBLFdBQUEsU0FBQSxHQUFBLGNBQUE7QUFDQSxXQUFBLFdBQUEsR0FBQSxFQUFBO0FBQ0EsV0FBQSxrQkFBQSxHQUFBLEVBQUE7QUFDQTs7QUFFQSxTQUFBLE9BQUEsR0FBQSxVQUFBLElBQUEsRUFBQTtBQUNBLFFBQUEsQ0FBQSxLQUFBLE9BQUEsRUFBQSxLQUFBLE9BQUEsR0FBQSxRQUFBLE9BQUE7QUFDQSxRQUFBLE9BQUE7O0FBRUEsV0FBQSxZQUFBLFVBQUEsQ0FBQSxLQUFBLElBQUEsRUFBQSxLQUFBLFdBQUEsRUFBQSxLQUFBLE9BQUEsRUFDQSxJQURBLENBQ0EsVUFBQSxTQUFBLEVBQUE7QUFDQSxnQkFBQSxTQUFBO0FBQ0EsVUFBQSxjQUFBLEVBQUE7QUFDQSxXQUFBLElBQUEsR0FBQSxJQUFBLEtBQUEsU0FBQSxFQUFBO0FBQ0EsWUFBQSxLQUFBLFNBQUEsQ0FBQSxHQUFBLENBQUEsRUFBQSxZQUFBLElBQUEsQ0FBQSxDQUFBLEdBQUE7QUFDQTtBQUNBLGFBQUEsR0FBQSxHQUFBLENBQUEsWUFBQSxHQUFBLENBQUEsVUFBQSxVQUFBLEVBQUE7QUFDQSxlQUFBLFlBQUEsaUJBQUEsQ0FBQSxVQUFBLEVBQUEsRUFBQSxVQUFBLENBQUE7QUFDQSxPQUZBLENBQUEsRUFHQSxJQUhBLENBR0EsWUFBQTtBQUNBLGVBQUEsWUFBQSxhQUFBLENBQUEsVUFBQSxFQUFBLENBQUE7QUFDQSxPQUxBLENBQUE7QUFNQSxLQWJBLEVBY0EsSUFkQSxDQWNBO0FBQUEsYUFBQSxrQkFBQSxLQUFBLENBQUEsSUFBQSxDQUFBO0FBQUEsS0FkQSxDQUFBO0FBZUEsR0FuQkE7O0FBcUJBLFNBQUEsTUFBQSxHQUFBLFlBQUE7QUFDQSxzQkFBQSxLQUFBO0FBQ0EsR0FGQTs7QUFJQSxTQUFBLEtBQUEsR0FBQSxZQUFBO0FBQ0Esc0JBQUEsT0FBQSxDQUFBLFFBQUE7QUFDQSxHQUZBO0FBSUEsQ0E1Q0E7O0FDQUEsSUFBQSxVQUFBLENBQUEsc0JBQUEsRUFBQSxVQUFBLE1BQUEsRUFBQSxpQkFBQSxFQUFBLE9BQUEsRUFBQSxlQUFBLEVBQUE7QUFDQSxTQUFBLFNBQUEsR0FBQSxxQkFBQSxRQUFBLFNBQUE7QUFDQSxNQUFBLFVBQUEsUUFBQSxPQUFBOztBQUVBLFNBQUEsV0FBQSxHQUFBLFVBQUEsUUFBQSxFQUFBO0FBQ0EsV0FBQSxnQkFBQSxjQUFBLENBQUEsU0FBQSxJQUFBLEVBQUEsU0FBQSxHQUFBLEVBQUEsU0FBQSxJQUFBLEVBQUEsT0FBQSxFQUNBLElBREEsQ0FDQSxVQUFBLFdBQUEsRUFBQTtBQUNBLHdCQUFBLEtBQUEsQ0FBQSxXQUFBO0FBQ0EsS0FIQSxDQUFBO0FBSUEsR0FMQTs7QUFPQSxTQUFBLE1BQUEsR0FBQSxZQUFBO0FBQ0Esc0JBQUEsS0FBQTtBQUNBLEdBRkE7O0FBSUEsU0FBQSxLQUFBLEdBQUEsWUFBQTtBQUNBLHNCQUFBLE9BQUEsQ0FBQSxRQUFBO0FBQ0EsR0FGQTtBQUlBLENBbkJBOztBQ0FBLElBQUEsVUFBQSxDQUFBLDRCQUFBLEVBQUEsVUFBQSxNQUFBLEVBQUEsU0FBQSxFQUFBLGlCQUFBLEVBQUEsS0FBQSxFQUFBLFFBQUEsRUFBQSxPQUFBLEVBQUEsZUFBQSxFQUFBLFdBQUEsRUFBQSxPQUFBLEVBQUE7QUFDQSxTQUFBLFNBQUEsR0FBQSxXQUFBLFNBQUEsSUFBQSxHQUFBLHdCQUFBO0FBQ0EsU0FBQSxLQUFBLEdBQUEsTUFBQSxNQUFBLENBQUEsQ0FBQSxFQUFBLE1BQUEsdUJBQUEsRUFBQSxJQUFBLENBQUEsRUFBQSxDQUFBLENBQUEsQztBQUNBLFNBQUEsUUFBQSxHQUFBLFFBQUE7OztBQUlBLFNBQUEsaUJBQUEsR0FBQSxVQUFBLFlBQUEsRUFBQTtBQUNBLFFBQUEsYUFBQSxHQUFBLEVBQUE7QUFDQSxVQUFBLGNBQUEsdUJBQUE7QUFDQSxhQUFBLFlBQUEsVUFBQSxDQUFBLGFBQUEsR0FBQSxFQUFBLFdBQUEsRUFBQSxPQUFBLEVBQ0EsSUFEQSxDQUNBLFVBQUEsT0FBQSxFQUFBO0FBQ0EsZUFBQSxZQUFBLGlCQUFBLENBQUEsUUFBQSxFQUFBLEVBQUEsT0FBQSxRQUFBLENBQUEsRUFBQSxDQUFBO0FBQ0EsT0FIQSxFQUlBLElBSkEsQ0FJQSxVQUFBLFdBQUEsRUFBQTtBQUNBLDBCQUFBLEtBQUEsQ0FBQSxXQUFBO0FBQ0EsT0FOQSxDQUFBO0FBT0EsS0FUQSxNQVNBO0FBQ0EsYUFBQSxZQUFBLGlCQUFBLENBQUEsYUFBQSxRQUFBLENBQUEsRUFBQSxFQUFBLE9BQUEsUUFBQSxDQUFBLEVBQUEsRUFDQSxJQURBLENBQ0EsVUFBQSxXQUFBLEVBQUE7QUFDQSwwQkFBQSxLQUFBLENBQUEsV0FBQTtBQUNBLE9BSEEsQ0FBQTtBQUlBO0FBQ0EsR0FoQkE7O0FBa0JBLFNBQUEsTUFBQSxHQUFBLFlBQUE7QUFDQSxzQkFBQSxLQUFBO0FBQ0EsR0FGQTs7QUFJQSxTQUFBLEtBQUEsR0FBQSxZQUFBO0FBQ0Esc0JBQUEsT0FBQSxDQUFBLFFBQUE7QUFDQSxHQUZBO0FBSUEsQ0FqQ0E7O0FDQUEsSUFBQSxVQUFBLENBQUEsbUJBQUEsRUFBQSxVQUFBLE1BQUEsRUFBQSxpQkFBQSxFQUFBLFlBQUEsRUFBQTtBQUNBLFNBQUEsU0FBQSxHQUFBLGVBQUE7O0FBRUEsU0FBQSxRQUFBLEdBQUEsVUFBQSxLQUFBLEVBQUE7QUFDQSxXQUFBLGFBQUEsV0FBQSxDQUFBLE1BQUEsSUFBQSxFQUFBLE1BQUEsV0FBQSxFQUNBLElBREEsQ0FDQSxVQUFBLFFBQUEsRUFBQTtBQUNBLHdCQUFBLEtBQUEsQ0FBQSxRQUFBO0FBQ0EsS0FIQSxDQUFBO0FBSUEsR0FMQTs7QUFPQSxTQUFBLE1BQUEsR0FBQSxZQUFBO0FBQ0Esc0JBQUEsS0FBQTtBQUNBLEdBRkE7O0FBSUEsU0FBQSxLQUFBLEdBQUEsWUFBQTtBQUNBLHNCQUFBLE9BQUEsQ0FBQSxRQUFBO0FBQ0EsR0FGQTtBQUlBLENBbEJBOzs7QUNDQSxJQUFBLFVBQUEsQ0FBQSwwQkFBQSxFQUFBLFVBQUEsTUFBQSxFQUFBLE9BQUEsRUFBQSxPQUFBLEVBQUEsaUJBQUEsRUFBQSxXQUFBLEVBQUE7QUFDQSxTQUFBLE9BQUEsR0FBQSxDQUFBLGlCQUFBLEVBQUEsTUFBQSxFQUFBLFdBQUEsQ0FBQTs7QUFFQSxNQUFBLFFBQUEsSUFBQSxLQUFBLFVBQUEsRUFBQTtBQUNBLFdBQUEsT0FBQSxDQUFBLElBQUEsQ0FBQSxXQUFBO0FBQ0EsV0FBQSxPQUFBLEdBQUEsaUJBQUE7QUFDQSxXQUFBLE9BQUEsR0FBQSxVQUFBO0FBQ0EsR0FKQSxNQUtBO0FBQ0EsV0FBQSxPQUFBLEdBQUEsY0FBQTtBQUNBLFdBQUEsT0FBQSxHQUFBLE9BQUE7QUFDQTtBQUNBLFNBQUEsRUFBQSxHQUFBLFFBQUEsRUFBQTs7QUFFQSxTQUFBLE1BQUEsR0FBQSxVQUFBLElBQUEsRUFBQTs7QUFFQSxnQkFBQSxPQUFBLE9BQUEsRUFBQSxPQUFBLEVBQUEsRUFBQSxJQUFBLEVBQ0EsSUFEQSxDQUNBLFVBQUEsR0FBQSxFQUFBO0FBQ0EsVUFBQSxJQUFBLENBQUEsTUFBQSxHQUFBLEVBQUEsUUFBQSxLQUFBLENBQUEsR0FBQTtBQUNBLHdCQUFBLEtBQUE7QUFDQSxLQUpBO0FBS0EsR0FQQTs7QUFVQSxTQUFBLE1BQUEsR0FBQSxZQUFBO0FBQ0Esc0JBQUEsT0FBQSxDQUFBLFFBQUE7QUFDQSxHQUZBO0FBR0EsQ0EzQkE7OztBQStCQSxJQUFBLFVBQUEsQ0FBQSxtQkFBQSxFQUFBLFVBQUEsTUFBQSxFQUFBLGlCQUFBLEVBQUEsV0FBQSxFQUFBOztBQUVBLFNBQUEsT0FBQSxHQUFBLE9BQUEsUUFBQSxHQUFBLGdCQUFBLEdBQUEsYUFBQTs7QUFFQSxTQUFBLEVBQUEsR0FBQSxZQUFBO0FBQ0Esc0JBQUEsS0FBQTtBQUNBLEdBRkE7O0FBSUEsU0FBQSxLQUFBLEdBQUEsWUFBQTtBQUNBLHNCQUFBLE9BQUEsQ0FBQSxRQUFBO0FBQ0EsR0FGQTs7QUFJQSxTQUFBLE1BQUEsR0FBQSxVQUFBLElBQUEsRUFBQTtBQUNBLFFBQUEsYUFBQSxPQUFBLFFBQUEsR0FBQSxZQUFBLGtCQUFBLEdBQUEsWUFBQSxlQUFBO0FBQ0EsUUFBQSxVQUFBLE9BQUEsUUFBQSxHQUFBLFlBQUEsR0FBQSxTQUFBO0FBQ0EsZUFBQSxLQUFBLEVBQUEsRUFBQSxLQUFBLE9BQUEsQ0FBQSxFQUNBLElBREEsQ0FDQSxVQUFBLEtBQUEsRUFBQTtBQUNBLGFBQUEsS0FBQSxHQUFBLEtBQUE7QUFDQSxLQUhBO0FBSUEsR0FQQTtBQVNBLENBckJBOztBQ2hDQSxJQUFBLFVBQUEsQ0FBQSx1QkFBQSxFQUFBLFVBQUEsTUFBQSxFQUFBLGlCQUFBLEVBQUEsT0FBQSxFQUFBLE1BQUEsRUFBQSxZQUFBLEVBQUE7O0FBRUEsU0FBQSxNQUFBLEdBQUEsTUFBQTtBQUNBLFNBQUEsU0FBQSxHQUFBLFFBQUEsU0FBQTtBQUNBLFNBQUEsY0FBQSxHQUFBLFFBQUEsY0FBQTtBQUNBLE1BQUEsVUFBQSxRQUFBLE9BQUE7OztBQUdBLFNBQUEsWUFBQSxHQUFBLFVBQUEsSUFBQSxFQUFBLFlBQUEsRUFBQTtBQUNBLFdBQUEsYUFBQSxZQUFBLENBQUEsSUFBQSxFQUFBLE9BQUEsRUFBQSxZQUFBLEVBQ0EsSUFEQSxDQUNBLFVBQUEsR0FBQSxFQUFBOztBQUVBLFVBQUEsWUFBQSxFQUFBLE9BQUEsWUFBQSxFQUFBO0FBQ0EsVUFBQSxTQUFBLFFBQUEsRUFBQTtBQUNBLGtCQUFBLGNBQUEsR0FBQSxJQUFBLElBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxFQUFBLGNBQUE7QUFDQSxPQUZBLE1BRUEsSUFBQSxTQUFBLFFBQUEsRUFBQTs7OztBQUlBLGtCQUFBLE9BQUEsR0FBQSxJQUFBLElBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxFQUFBLE9BQUE7QUFDQTtBQUNBLHdCQUFBLEtBQUEsQ0FBQSxDQUFBLElBQUEsRUFBQSxTQUFBLENBQUE7QUFDQSxLQWJBLENBQUE7QUFjQSxHQWZBOztBQWlCQSxTQUFBLE1BQUEsR0FBQSxZQUFBO0FBQ0Esc0JBQUEsS0FBQTtBQUNBLEdBRkE7O0FBSUEsU0FBQSxLQUFBLEdBQUEsWUFBQTtBQUNBLHNCQUFBLE9BQUEsQ0FBQSxRQUFBO0FBQ0EsR0FGQTtBQUlBLENBakNBOztBQ0FBLElBQUEsU0FBQSxDQUFBLGNBQUEsRUFBQSxZQUFBO0FBQ0EsU0FBQTtBQUNBLGNBQUEsR0FEQTtBQUVBLGlCQUFBO0FBRkEsR0FBQTtBQUlBLENBTEE7O0FDQUEsSUFBQSxTQUFBLENBQUEsU0FBQSxFQUFBLFlBQUE7O0FBRUEsU0FBQTtBQUNBLGNBQUEsR0FEQTtBQUVBLGlCQUFBLDJDQUZBO0FBR0EsV0FBQTtBQUNBLGNBQUEsR0FEQTtBQUVBLGVBQUE7QUFGQSxLQUhBO0FBT0EsZ0JBQUEsb0JBQUEsTUFBQSxFQUFBLE1BQUEsRUFBQSxZQUFBLEVBQUE7O0FBRUEsVUFBQSxRQUFBLE9BQUEsVUFBQTtBQUFBLFVBQ0EsU0FBQSxPQUFBLFdBREE7Ozs7QUFLQSxVQUFBLFFBQUEsR0FBQSxLQUFBLENBQUEsVUFBQSxFQUFBOzs7OztBQU1BLFVBQUEsV0FBQSxHQUFBLEtBQUEsQ0FBQSxNQUFBLEVBQUE7O0FBRUEsZUFBQSxNQUFBLENBQUEsR0FBQSxNQUFBLENBQUEsT0FBQSxNQUFBLEVBQUEsVUFBQSxDQUFBLEVBQUE7QUFBQSxlQUFBLEVBQUEsU0FBQSxDQUFBLE1BQUE7QUFBQSxPQUFBLENBQUE7QUFDQSxlQUFBLEtBQUEsQ0FBQSxDQUFBLEVBQUEsRUFBQSxFQUFBLENBQUE7Ozs7Ozs7QUFRQSxVQUFBLE1BQUEsR0FBQSxNQUFBLENBQUEsT0FBQSxFQUNBLE1BREEsQ0FDQSxLQURBOztBQUFBLE9BR0EsTUFIQSxDQUdBLEtBSEE7Ozs7OztBQUFBLE9BU0EsSUFUQSxDQVNBLE9BVEEsRUFTQSxLQVRBLEVBVUEsSUFWQSxDQVVBLFFBVkEsRUFVQSxNQVZBOztBQUFBLE9BWUEsSUFaQSxDQVlBLEdBQUEsUUFBQSxDQUFBLElBQUEsR0FDQSxFQURBLENBQ0EsTUFEQSxFQUNBLE1BREEsQ0FaQSxFQWNBLE1BZEEsQ0FjQSxHQWRBLENBQUE7O0FBaUJBLGVBQUEsTUFBQSxHQUFBO0FBQ0EsWUFBQSxJQUFBLENBQUEsV0FBQSxFQUFBLGVBQUEsR0FBQSxLQUFBLENBQUEsU0FBQSxHQUFBLEdBQUEsR0FBQSxTQUFBLEdBQUEsR0FBQSxLQUFBLENBQUEsS0FBQSxHQUFBLEdBQUE7QUFDQTs7Ozs7Ozs7O0FBVUEsVUFBQSxRQUFBLEdBQUEsTUFBQSxDQUNBLEtBREEsR0FFQSxNQUZBLENBRUEsQ0FBQSxHQUZBLEVBR0EsWUFIQSxDQUdBLEdBSEEsRUFJQSxJQUpBLENBSUEsQ0FBQSxLQUFBLEVBQUEsTUFBQSxDQUpBLENBQUE7Ozs7QUFTQSxVQUFBLE9BQUEsTUFBQSxJQUFBLEdBQ0EsSUFEQSxHQUVBLEVBRkEsQ0FFQSxXQUZBLEVBRUEsVUFBQSxDQUFBLEVBQUE7QUFBQSxXQUFBLEtBQUEsQ0FBQSxXQUFBLENBQUEsZUFBQTtBQUNBLE9BSEEsQ0FBQTs7O0FBUUEsVUFBQSxPQUFBLEVBQUEsQztBQUNBLFVBQUEsWUFBQSxFQUFBLEM7OztBQUdBLGFBQUEsTUFBQSxDQUFBLE9BQUEsQ0FBQSxVQUFBLElBQUEsRUFBQTtBQUNBLGFBQUEsS0FBQSxFQUFBLElBQUEsSUFBQTtBQUNBLE9BRkE7OztBQUtBLGFBQUEsT0FBQSxDQUFBLE9BQUEsQ0FBQSxVQUFBLElBQUEsRUFBQTtBQUNBLGtCQUFBLElBQUEsQ0FBQSxFQUFBLFFBQUEsS0FBQSxLQUFBLE9BQUEsQ0FBQSxFQUFBLFFBQUEsS0FBQSxLQUFBLGNBQUEsQ0FBQSxFQUFBLE9BQUEsQ0FBQSxFQUFBO0FBQ0EsT0FGQTs7O0FBTUEsWUFDQSxLQURBLENBQ0EsT0FBQSxNQURBLEVBRUEsS0FGQSxDQUVBLFNBRkEsRUFHQSxLQUhBOzs7O0FBU0EsVUFBQSxPQUFBLElBQUEsU0FBQSxDQUFBLE9BQUEsRUFDQSxJQURBLENBQ0EsU0FEQSxFQUVBLEtBRkEsR0FFQSxNQUZBLENBRUEsTUFGQSxDO0FBQUEsT0FHQSxJQUhBLENBR0EsT0FIQSxFQUdBLE1BSEEsQztBQUFBLE9BSUEsS0FKQSxDQUlBLFFBSkEsRUFJQSxPQUpBLEM7O0FBQUEsT0FNQSxLQU5BLENBTUEsY0FOQSxFQU1BLFVBQUEsQ0FBQSxFQUFBO0FBQUEsZUFBQSxLQUFBLElBQUEsQ0FBQSxFQUFBLEtBQUEsQ0FBQTtBQUFBLE9BTkEsQ0FBQTs7QUFVQSxVQUFBLE9BQUEsSUFBQSxTQUFBLENBQUEsUUFBQSxFQUNBLElBREEsQ0FDQSxPQUFBLE1BREEsRUFFQSxLQUZBLEdBR0EsTUFIQSxDQUdBLEdBSEEsQztBQUFBLE9BSUEsSUFKQSxDQUlBLE9BSkEsRUFJQSxNQUpBLEM7QUFBQSxPQUtBLElBTEEsQ0FLQSxNQUFBLElBTEEsQztBQUFBLE9BTUEsRUFOQSxDQU1BLFVBTkEsRUFNQSxVQUFBLENBQUEsRUFBQTtBQUFBLGVBQUEsRUFBQSxDQUFBLE9BQUEsRUFBQSxFQUFBLFNBQUEsRUFBQSxFQUFBLEVBQUE7QUFBQSxPQU5BLEM7QUFBQSxPQU9BLEVBUEEsQ0FPQSxPQVBBLEVBT0EsY0FQQSxDQUFBLEM7O0FBVUEsV0FBQSxNQUFBLENBQUEsUUFBQSxDO0FBQUEsT0FDQSxJQURBLENBQ0EsR0FEQSxFQUNBLFVBQUEsQ0FBQSxFQUFBO0FBQUEsZUFBQSxTQUFBLEVBQUEsU0FBQSxDQUFBLE1BQUEsQ0FBQTtBQUFBLE9BREEsRUFFQSxJQUZBLENBRUEsSUFGQSxFQUVBLFVBQUEsQ0FBQSxFQUFBO0FBQUEsZUFBQSxFQUFBLEtBQUE7QUFBQSxPQUZBLEVBR0EsS0FIQSxDQUdBLE1BSEEsRUFHQSxVQUFBLENBQUEsRUFBQTtBQUFBLGVBQUEsTUFBQSxFQUFBLEtBQUEsQ0FBQTtBQUFBLE9BSEE7O0FBTUEsV0FBQSxNQUFBLENBQUEsTUFBQSxDO0FBQUEsT0FDQSxJQURBLENBQ0EsYUFEQSxFQUNBLFFBREEsRUFFQSxJQUZBLENBRUEsR0FGQSxFQUVBLFVBQUEsQ0FBQSxFQUFBO0FBQUEsZUFBQSxFQUFBLENBQUE7QUFBQSxPQUZBLEVBR0EsSUFIQSxDQUdBLEdBSEEsRUFHQSxVQUFBLENBQUEsRUFBQTtBQUFBLGVBQUEsRUFBQSxDQUFBO0FBQUEsT0FIQSxFQUlBLElBSkEsQ0FJQSxVQUFBLENBQUEsRUFBQTtBQUFBLGVBQUEsRUFBQSxLQUFBO0FBQUEsT0FKQTs7O0FBUUEsWUFBQSxFQUFBLENBQUEsTUFBQSxFQUFBLFlBQUE7O0FBRUEsYUFDQSxJQURBLENBQ0EsSUFEQSxFQUNBLFVBQUEsQ0FBQSxFQUFBO0FBQUEsaUJBQUEsRUFBQSxNQUFBLENBQUEsQ0FBQTtBQUFBLFNBREEsRUFFQSxJQUZBLENBRUEsSUFGQSxFQUVBLFVBQUEsQ0FBQSxFQUFBO0FBQUEsaUJBQUEsRUFBQSxNQUFBLENBQUEsQ0FBQTtBQUFBLFNBRkEsRUFHQSxJQUhBLENBR0EsSUFIQSxFQUdBLFVBQUEsQ0FBQSxFQUFBO0FBQUEsaUJBQUEsRUFBQSxNQUFBLENBQUEsQ0FBQTtBQUFBLFNBSEEsRUFJQSxJQUpBLENBSUEsSUFKQSxFQUlBLFVBQUEsQ0FBQSxFQUFBO0FBQUEsaUJBQUEsRUFBQSxNQUFBLENBQUEsQ0FBQTtBQUFBLFNBSkE7O0FBT0EsWUFBQSxTQUFBLEdBQUEsU0FBQSxDQUFBLFFBQUEsRUFDQSxJQURBLENBQ0EsSUFEQSxFQUNBLFVBQUEsQ0FBQSxFQUFBO0FBQUEsaUJBQUEsRUFBQSxDQUFBO0FBQUEsU0FEQSxFQUVBLElBRkEsQ0FFQSxJQUZBLEVBRUEsVUFBQSxDQUFBLEVBQUE7QUFBQSxpQkFBQSxFQUFBLENBQUE7QUFBQSxTQUZBLENBQUE7O0FBS0EsV0FBQSxTQUFBLENBQUEsTUFBQSxFQUNBLElBREEsQ0FDQSxHQURBLEVBQ0EsVUFBQSxDQUFBLEVBQUE7QUFBQSxpQkFBQSxFQUFBLENBQUE7QUFBQSxTQURBLEVBRUEsSUFGQSxDQUVBLEdBRkEsRUFFQSxVQUFBLENBQUEsRUFBQTtBQUFBLGlCQUFBLEVBQUEsQ0FBQTtBQUFBLFNBRkE7QUFJQSxPQWxCQTs7Ozs7QUF3QkEsVUFBQSxTQUFBLENBQUE7OztBQUdBLFVBQUEsZ0JBQUEsRUFBQTtBQUNBLFdBQUEsSUFBQSxJQUFBLENBQUEsRUFBQSxJQUFBLE9BQUEsTUFBQSxDQUFBLE1BQUEsRUFBQSxHQUFBLEVBQUE7QUFDQSxzQkFBQSxJQUFBLEdBQUEsR0FBQSxDQUFBLElBQUEsQ0FBQTtBQUNBO0FBQ0EsZ0JBQUEsT0FBQSxDQUFBLFVBQUEsQ0FBQSxFQUFBO0FBQ0Esc0JBQUEsRUFBQSxNQUFBLENBQUEsS0FBQSxHQUFBLEdBQUEsR0FBQSxFQUFBLE1BQUEsQ0FBQSxLQUFBLElBQUEsQ0FBQTtBQUNBLE9BRkE7OztBQUtBLGVBQUEsV0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEVBQUE7QUFDQSxlQUFBLGNBQUEsRUFBQSxLQUFBLEdBQUEsR0FBQSxHQUFBLEVBQUEsS0FBQSxDQUFBO0FBQ0E7O0FBRUEsZUFBQSxjQUFBLEdBQUE7O0FBRUEsWUFBQSxVQUFBLENBQUEsRUFBQTs7QUFFQSxjQUFBLElBQUEsR0FBQSxNQUFBLENBQUEsSUFBQSxFQUFBLElBQUEsR0FBQSxRQUFBO0FBQ0EsZUFBQSxLQUFBLENBQUEsU0FBQSxFQUFBLFVBQUEsQ0FBQSxFQUFBO0FBQ0EsbUJBQUEsWUFBQSxDQUFBLEVBQUEsQ0FBQSxJQUFBLFlBQUEsQ0FBQSxFQUFBLENBQUEsQ0FBQSxHQUFBLENBQUEsR0FBQSxHQUFBO0FBQ0EsV0FGQTs7QUFJQSxlQUFBLEtBQUEsQ0FBQSxTQUFBLEVBQUEsVUFBQSxDQUFBLEVBQUE7QUFDQSxtQkFBQSxFQUFBLEtBQUEsSUFBQSxFQUFBLE1BQUEsQ0FBQSxLQUFBLEdBQUEsRUFBQSxLQUFBLElBQUEsRUFBQSxNQUFBLENBQUEsS0FBQSxHQUFBLENBQUEsR0FBQSxHQUFBO0FBQ0EsV0FGQTs7OztBQU1BLG1CQUFBLENBQUE7QUFDQSxTQWRBLE1BY0E7O0FBRUEsZUFBQSxLQUFBLENBQUEsU0FBQSxFQUFBLENBQUE7QUFDQSxlQUFBLEtBQUEsQ0FBQSxTQUFBLEVBQUEsQ0FBQTtBQUNBLG1CQUFBLENBQUE7QUFDQTtBQUVBO0FBTUE7QUE1TUEsR0FBQTtBQStNQSxDQWpOQTs7QUNBQSxJQUFBLFNBQUEsQ0FBQSxRQUFBLEVBQUEsVUFBQSxVQUFBLEVBQUEsV0FBQSxFQUFBLFdBQUEsRUFBQSxNQUFBLEVBQUEsWUFBQSxFQUFBOztBQUVBLFNBQUE7QUFDQSxjQUFBLEdBREE7QUFFQSxXQUFBLEVBRkE7QUFHQSxpQkFBQSx5Q0FIQTtBQUlBLFVBQUEsY0FBQSxLQUFBLEVBQUE7O0FBRUEsWUFBQSxLQUFBLEdBQUEsQ0FDQSxFQUFBLE9BQUEsUUFBQSxFQUFBLE9BQUEsUUFBQSxFQURBLENBQUE7O0FBSUEsbUJBQUEsUUFBQSxHQUFBLElBQUEsQ0FBQTtBQUFBLGVBQUEsTUFBQSxNQUFBLEdBQUEsTUFBQTtBQUFBLE9BQUE7O0FBRUEsWUFBQSxjQUFBLEdBQUEsVUFBQSxlQUFBLEVBQUE7QUFDQSxlQUFBLEVBQUEsQ0FBQSxRQUFBLEVBQUEsRUFBQSxpQkFBQSxlQUFBLEVBQUE7QUFDQSxVQUFBLGtCQUFBLEVBQUEsV0FBQSxDQUFBLE1BQUEsRTtBQUNBLE9BSEE7O0FBS0EsWUFBQSxJQUFBLEdBQUEsSUFBQTs7QUFFQSxZQUFBLFVBQUEsR0FBQSxZQUFBO0FBQ0EsZUFBQSxZQUFBLGVBQUEsRUFBQTtBQUNBLE9BRkE7O0FBSUEsWUFBQSxNQUFBLEdBQUEsWUFBQTtB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QUFDQSxnQkFBQSxXQURBO0FBRUEsY0FBQSxNQUFBLFFBQUEsQ0FBQSxFQUZBO0FBR0EsaUJBQUEsTUFBQTtBQUhBLFNBQUE7QUFLQTtBQUVBO0FBckZBLEdBQUE7QUF1RkEsQ0F4RkEiLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcbndpbmRvdy5hcHAgPSBhbmd1bGFyLm1vZHVsZSgnQ2Fwc3RvbmVBcHAnLCBbJ2ZzYVByZUJ1aWx0JywgJ3VpLnJvdXRlcicsICd1aS5ib290c3RyYXAnLCAnbmdBbmltYXRlJ10pO1xuXG5hcHAuY29uZmlnKGZ1bmN0aW9uICgkdXJsUm91dGVyUHJvdmlkZXIsICRsb2NhdGlvblByb3ZpZGVyKSB7XG4gICAgLy8gVGhpcyB0dXJucyBvZmYgaGFzaGJhbmcgdXJscyAoLyNhYm91dCkgYW5kIGNoYW5nZXMgaXQgdG8gc29tZXRoaW5nIG5vcm1hbCAoL2Fib3V0KVxuICAgICRsb2NhdGlvblByb3ZpZGVyLmh0bWw1TW9kZSh0cnVlKTtcbiAgICAvLyBJZiB3ZSBnbyB0byBhIFVSTCB0aGF0IHVpLXJvdXRlciBkb2Vzbid0IGhhdmUgcmVnaXN0ZXJlZCwgZ28gdG8gdGhlIFwiL1wiIHVybC5cbiAgICAkdXJsUm91dGVyUHJvdmlkZXIub3RoZXJ3aXNlKCcvJyk7XG4gICAgLy8gVHJpZ2dlciBwYWdlIHJlZnJlc2ggd2hlbiBhY2Nlc3NpbmcgYW4gT0F1dGggcm91dGVcbiAgICAkdXJsUm91dGVyUHJvdmlkZXIud2hlbignL2F1dGgvOnByb3ZpZGVyJywgZnVuY3Rpb24gKCkge1xuICAgICAgICB3aW5kb3cubG9jYXRpb24ucmVsb2FkKCk7XG4gICAgfSk7XG59KTtcblxuLy8gVGhpcyBhcHAucnVuIGlzIGZvciBjb250cm9sbGluZyBhY2Nlc3MgdG8gc3BlY2lmaWMgc3RhdGVzLlxuYXBwLnJ1bihmdW5jdGlvbiAoJHJvb3RTY29wZSwgQXV0aFNlcnZpY2UsICRzdGF0ZSkge1xuXG4gICAgLy8gVGhlIGdpdmVuIHN0YXRlIHJlcXVpcmVzIGFuIGF1dGhlbnRpY2F0ZWQgdXNlci5cbiAgICB2YXIgZGVzdGluYXRpb25TdGF0ZVJlcXVpcmVzQXV0aCA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuICAgICAgICByZXR1cm4gc3RhdGUuZGF0YSAmJiBzdGF0ZS5kYXRhLmF1dGhlbnRpY2F0ZTtcbiAgICB9O1xuXG4gICAgLy8gJHN0YXRlQ2hhbmdlU3RhcnQgaXMgYW4gZXZlbnQgZmlyZWRcbiAgICAvLyB3aGVuZXZlciB0aGUgcHJvY2VzcyBvZiBjaGFuZ2luZyBhIHN0YXRlIGJlZ2lucy5cbiAgICAkcm9vdFNjb3BlLiRvbignJHN0YXRlQ2hhbmdlU3RhcnQnLCBmdW5jdGlvbiAoZXZlbnQsIHRvU3RhdGUsIHRvUGFyYW1zKSB7XG5cbiAgICAgICAgaWYgKCFkZXN0aW5hdGlvblN0YXRlUmVxdWlyZXNBdXRoKHRvU3RhdGUpKSB7XG4gICAgICAgICAgICAvLyBUaGUgZGVzdGluYXRpb24gc3RhdGUgZG9lcyBub3QgcmVxdWlyZSBhdXRoZW50aWNhdGlvblxuICAgICAgICAgICAgLy8gU2hvcnQgY2lyY3VpdCB3aXRoIHJldHVybi5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChBdXRoU2VydmljZS5pc0F1dGhlbnRpY2F0ZWQoKSkge1xuICAgICAgICAgICAgLy8gVGhlIHVzZXIgaXMgYXV0aGVudGljYXRlZC5cbiAgICAgICAgICAgIC8vIFNob3J0IGNpcmN1aXQgd2l0aCByZXR1cm4uXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDYW5jZWwgbmF2aWdhdGluZyB0byBuZXcgc3RhdGUuXG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgQXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICAgICAgLy8gSWYgYSB1c2VyIGlzIHJldHJpZXZlZCwgdGhlbiByZW5hdmlnYXRlIHRvIHRoZSBkZXN0aW5hdGlvblxuICAgICAgICAgICAgLy8gKHRoZSBzZWNvbmQgdGltZSwgQXV0aFNlcnZpY2UuaXNBdXRoZW50aWNhdGVkKCkgd2lsbCB3b3JrKVxuICAgICAgICAgICAgLy8gb3RoZXJ3aXNlLCBpZiBubyB1c2VyIGlzIGxvZ2dlZCBpbiwgZ28gdG8gXCJsb2dpblwiIHN0YXRlLlxuICAgICAgICAgICAgaWYgKHVzZXIpIHtcbiAgICAgICAgICAgICAgICAkc3RhdGUuZ28odG9TdGF0ZS5uYW1lLCB0b1BhcmFtcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICRzdGF0ZS5nbygnbG9naW4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICB9KTtcblxufSk7XG5cbmFwcC5maWx0ZXIoJ29BdXRoRmlsdGVyJywgZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKGlucHV0KSB7XG4gICAgICAgIGlucHV0ID0gaW5wdXQudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGlmKGlucHV0ID09PSAnZ29vZ2xlJykgcmV0dXJuICdnb29nbGUtcGx1cyc7XG4gICAgICAgIGVsc2UgcmV0dXJuIGlucHV0XG4gICAgfVxufSk7XG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuXG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ2FkbWluJywge1xuICAgICAgICB1cmw6ICcvYWRtaW4nLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2FkbWluUGFuZWwvdGVtcGxhdGVzL2FkbWluLmh0bWwnLFxuICAgICAgICBjb250cm9sbGVyOiBmdW5jdGlvbigpIHtcbiAgICAgICAgfSxcbiAgICAgICAgcmVzb2x2ZToge1xuICAgICAgICAgICAgaXNBZG1pbjogZnVuY3Rpb24oJHN0YXRlLCBBdXRoU2VydmljZSl7XG4gICAgICAgICAgICAgIHJldHVybiBBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKVxuICAgICAgICAgICAgICAudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICAgICAgICAgIGlmKCF1c2VyIHx8IHVzZXIuaXNBZG1pbiA9PT0gZmFsc2UpICRzdGF0ZS5nbygnaG9tZScpXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdhZG1pbi50b3BpY3MnLCB7XG4gICAgICAgIHVybDogJy90b3BpY3MnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2FkbWluUGFuZWwvdGVtcGxhdGVzL3RvcGljcy5odG1sJyxcbiAgICAgICAgY29udHJvbGxlcjogZnVuY3Rpb24oJHNjb3BlLCB0b3BpY3MsIFRvcGljRmFjdG9yeSwgRmxhZ0ZhY3RvcnksIFByZXJlcUZhY3RvcnksICR1aWJNb2RhbCl7XG5cbiAgICAgICAgICAgJHNjb3BlLnRvcGljcz0gdG9waWNzO1xuXG4gICAgICAgICAgICRzY29wZS51cGRhdGU9IFRvcGljRmFjdG9yeS51cGRhdGVUb3BpYztcblxuICAgICAgICAgICAkc2NvcGUuZGVsZXRlPSBmdW5jdGlvbihpZCl7XG4gICAgICAgICAgICBUb3BpY0ZhY3RvcnkuZGVsZXRlVG9waWMoaWQpXG4gICAgICAgICAgICAudGhlbih1cGRhdGVkVG9waWNzID0+ICRzY29wZS50b3BpY3MgPSB1cGRhdGVkVG9waWNzKVxuICAgICAgICAgICB9XG5cbiAgICAgICAgICAgLy9wYXNzaW5nIGluIHRvcGljIGlkIGFuZCBwcmVyZXEgaWQgXG4gICAgICAgICAgICRzY29wZS5kZWxldGVQcmVyZXEgPSBmdW5jdGlvbih0b3BpY0lkLCBwcmVyZXFJZCl7XG4gICAgICAgICAgICAgIFByZXJlcUZhY3RvcnkucmVtb3ZlUmVsYXRpb25zaGlwKHRvcGljSWQsIHByZXJlcUlkKVxuICAgICAgICAgICAgICAudGhlbigpO1xuICAgICAgICAgICB9XG5cbiAgICAgICAgICAgLy9wYXNzaW5nIGlkcyBpbiBvcHBvc2l0ZSBvcmRlcnMgdG8gZGVsZXRlIGEgc3Vic2VxdWVudCByZWxhdGlvbnNoaXBcbiAgICAgICAgICAgJHNjb3BlLmRlbGV0ZVN1YnNlcSA9IGZ1bmN0aW9uKHRvcGljSWQsIHN1YnNlcUlkKXtcbiAgICAgICAgICAgICAgUHJlcmVxRmFjdG9yeS5yZW1vdmVSZWxhdGlvbnNoaXAoc3Vic2VxSWQsIHRvcGljSWQpXG4gICAgICAgICAgICAgIC50aGVuKCk7XG4gICAgICAgICAgIH1cblxuICAgICAgICAgICAgJHNjb3BlLm9wZW5GbGFncyA9IGZ1bmN0aW9uICh0b3BpY0lkKSB7XG5cbiAgICAgICAgICAgICAgRmxhZ0ZhY3RvcnkuZmV0Y2hUb3BpY0ZsYWdzKHRvcGljSWQpXG4gICAgICAgICAgICAgIC50aGVuKHRvcGljRmxhZ3MgPT4gJHNjb3BlLmZsYWdzPSB0b3BpY0ZsYWdzKTtcblxuICAgICAgICAgICAgICAgJHVpYk1vZGFsLm9wZW4oe1xuICAgICAgICAgICAgICAgICBhbmltYXRpb246ICRzY29wZS5hbmltYXRpb25zRW5hYmxlZCxcbiAgICAgICAgICAgICAgICAgc2NvcGU6ICRzY29wZSxcbiAgICAgICAgICAgICAgICAgdGVtcGxhdGVVcmw6ICcuL2pzL2NvbW1vbi9tb2RhbHMvdmlld3MvdG9waWNGbGFnTW9kYWwuaHRtbCcsXG4gICAgICAgICAgICAgICAgIGNvbnRyb2xsZXI6ICdNb2RhbEluc3RhbmNlQ3RybCdcbiAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgIH07XG5cbiAgICAgICAgfSxcbiAgICAgICAgcmVzb2x2ZToge1xuICAgICAgICAgIHRvcGljczogZnVuY3Rpb24oVG9waWNGYWN0b3J5KSB7XG4gICAgICAgICAgICByZXR1cm4gVG9waWNGYWN0b3J5LmZldGNoQWxsKClcbiAgICAgICAgICAgICAgLy8gcmV0dXJucyB0b3BpY3Mgd2l0aCB0aGUgcHJlcmVxcyBhbmQgc3Vic2VxcyBvbiBpdFxuICAgICAgICAgICAgICAudGhlbihmdW5jdGlvbihhbGxUb3BpY3Mpe1xuICAgICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLmFsbChhbGxUb3BpY3MubWFwKGZ1bmN0aW9uKGVsZW0pe1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIFRvcGljRmFjdG9yeS5mZXRjaEJ5SWQoZWxlbS5pZClcbiAgICAgICAgICAgICAgICB9KSlcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdhZG1pbi5yZXNvdXJjZXMnLCB7XG4gICAgICAgIHVybDogJy9yZXNvdXJjZXMnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2FkbWluUGFuZWwvdGVtcGxhdGVzL3Jlc291cmNlcy5odG1sJyxcbiAgICAgICAgY29udHJvbGxlcjogZnVuY3Rpb24oJHNjb3BlLCByZXNvdXJjZXMsIFJlc291cmNlRmFjdG9yeSwgRmxhZ0ZhY3RvcnksICR1aWJNb2RhbCl7XG5cbiAgICAgICAgICAkc2NvcGUucmVzb3VyY2VzPSByZXNvdXJjZXM7XG5cbiAgICAgICAgICAkc2NvcGUudXBkYXRlPSBSZXNvdXJjZUZhY3RvcnkudXBkYXRlUmVzb3VyY2U7XG5cbiAgICAgICAgICAkc2NvcGUudHlwZXM9IFsnYXJ0aWNsZScsICd2aWRlbycsICdib29rJywgJ2RvY3VtZW50YXRpb24nLCAndHV0b3JpYWwnLCAnb3RoZXInXTtcblxuICAgICAgICAgICRzY29wZS5mbGFnVHlwZT0gJ3Jlc291cmNlJztcblxuICAgICAgICAgICRzY29wZS5kZWxldGU9IGZ1bmN0aW9uKGlkKXtcbiAgICAgICAgICAgIFJlc291cmNlRmFjdG9yeS5kZWxldGVSZXNvdXJjZShpZClcbiAgICAgICAgICAgIC50aGVuKHVwZGF0ZWRSZXNvdXJjZXMgPT4gJHNjb3BlLnJlc291cmNlcz0gdXBkYXRlZFJlc291cmNlcylcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAkc2NvcGUub3BlbkZsYWdzID0gZnVuY3Rpb24gKHJlc291cmNlSWQpIHtcblxuICAgICAgICAgICAgRmxhZ0ZhY3RvcnkuZmV0Y2hSZXNvdXJjZUZsYWdzKHJlc291cmNlSWQpXG4gICAgICAgICAgICAudGhlbih1cGRhdGVkUmVzb3VyY2VGbGFncyA9PiAkc2NvcGUuZmxhZ3M9IHVwZGF0ZWRSZXNvdXJjZUZsYWdzKTtcblxuICAgICAgICAgICAgICR1aWJNb2RhbC5vcGVuKHtcbiAgICAgICAgICAgICAgIGFuaW1hdGlvbjogJHNjb3BlLmFuaW1hdGlvbnNFbmFibGVkLFxuICAgICAgICAgICAgICAgc2NvcGU6ICRzY29wZSxcbiAgICAgICAgICAgICAgIHRlbXBsYXRlVXJsOiAnLi9qcy9jb21tb24vbW9kYWxzL3ZpZXdzL3RvcGljRmxhZ01vZGFsLmh0bWwnLFxuICAgICAgICAgICAgICAgY29udHJvbGxlcjogJ01vZGFsSW5zdGFuY2VDdHJsJ1xuICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgIH07XG5cbiAgICAgICAgfSxcbiAgICAgICAgcmVzb2x2ZToge1xuICAgICAgICAgIHJlc291cmNlczogZnVuY3Rpb24oUmVzb3VyY2VGYWN0b3J5KXtcbiAgICAgICAgICAgIHJldHVybiBSZXNvdXJjZUZhY3RvcnkuZmV0Y2hBbGwoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgIH0pO1xuXG59KTtcbiIsIihmdW5jdGlvbiAoKSB7XG5cbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICAvLyBIb3BlIHlvdSBkaWRuJ3QgZm9yZ2V0IEFuZ3VsYXIhIER1aC1kb3kuXG4gICAgaWYgKCF3aW5kb3cuYW5ndWxhcikgdGhyb3cgbmV3IEVycm9yKCdJIGNhblxcJ3QgZmluZCBBbmd1bGFyIScpO1xuXG4gICAgdmFyIGFwcCA9IGFuZ3VsYXIubW9kdWxlKCdmc2FQcmVCdWlsdCcsIFtdKTtcblxuICAgIGFwcC5mYWN0b3J5KCdTb2NrZXQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghd2luZG93LmlvKSB0aHJvdyBuZXcgRXJyb3IoJ3NvY2tldC5pbyBub3QgZm91bmQhJyk7XG4gICAgICAgIHJldHVybiB3aW5kb3cuaW8od2luZG93LmxvY2F0aW9uLm9yaWdpbik7XG4gICAgfSk7XG5cbiAgICAvLyBBVVRIX0VWRU5UUyBpcyB1c2VkIHRocm91Z2hvdXQgb3VyIGFwcCB0b1xuICAgIC8vIGJyb2FkY2FzdCBhbmQgbGlzdGVuIGZyb20gYW5kIHRvIHRoZSAkcm9vdFNjb3BlXG4gICAgLy8gZm9yIGltcG9ydGFudCBldmVudHMgYWJvdXQgYXV0aGVudGljYXRpb24gZmxvdy5cbiAgICBhcHAuY29uc3RhbnQoJ0FVVEhfRVZFTlRTJywge1xuICAgICAgICBsb2dpblN1Y2Nlc3M6ICdhdXRoLWxvZ2luLXN1Y2Nlc3MnLFxuICAgICAgICBsb2dpbkZhaWxlZDogJ2F1dGgtbG9naW4tZmFpbGVkJyxcbiAgICAgICAgbG9nb3V0U3VjY2VzczogJ2F1dGgtbG9nb3V0LXN1Y2Nlc3MnLFxuICAgICAgICBzZXNzaW9uVGltZW91dDogJ2F1dGgtc2Vzc2lvbi10aW1lb3V0JyxcbiAgICAgICAgbm90QXV0aGVudGljYXRlZDogJ2F1dGgtbm90LWF1dGhlbnRpY2F0ZWQnLFxuICAgICAgICBub3RBdXRob3JpemVkOiAnYXV0aC1ub3QtYXV0aG9yaXplZCdcbiAgICB9KTtcblxuICAgIGFwcC5mYWN0b3J5KCdBdXRoSW50ZXJjZXB0b3InLCBmdW5jdGlvbiAoJHJvb3RTY29wZSwgJHEsIEFVVEhfRVZFTlRTKSB7XG4gICAgICAgIHZhciBzdGF0dXNEaWN0ID0ge1xuICAgICAgICAgICAgNDAxOiBBVVRIX0VWRU5UUy5ub3RBdXRoZW50aWNhdGVkLFxuICAgICAgICAgICAgNDAzOiBBVVRIX0VWRU5UUy5ub3RBdXRob3JpemVkLFxuICAgICAgICAgICAgNDE5OiBBVVRIX0VWRU5UUy5zZXNzaW9uVGltZW91dCxcbiAgICAgICAgICAgIDQ0MDogQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXRcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHJlc3BvbnNlRXJyb3I6IGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdChzdGF0dXNEaWN0W3Jlc3BvbnNlLnN0YXR1c10sIHJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gJHEucmVqZWN0KHJlc3BvbnNlKVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH0pO1xuXG4gICAgYXBwLmNvbmZpZyhmdW5jdGlvbiAoJGh0dHBQcm92aWRlcikge1xuICAgICAgICAkaHR0cFByb3ZpZGVyLmludGVyY2VwdG9ycy5wdXNoKFtcbiAgICAgICAgICAgICckaW5qZWN0b3InLFxuICAgICAgICAgICAgZnVuY3Rpb24gKCRpbmplY3Rvcikge1xuICAgICAgICAgICAgICAgIHJldHVybiAkaW5qZWN0b3IuZ2V0KCdBdXRoSW50ZXJjZXB0b3InKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgXSk7XG4gICAgfSk7XG5cbiAgICBhcHAuc2VydmljZSgnQXV0aFNlcnZpY2UnLCBmdW5jdGlvbiAoJGh0dHAsIFNlc3Npb24sICRyb290U2NvcGUsIEFVVEhfRVZFTlRTLCAkcSkge1xuXG4gICAgICAgIGZ1bmN0aW9uIG9uU3VjY2Vzc2Z1bExvZ2luKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICB2YXIgZGF0YSA9IHJlc3BvbnNlLmRhdGE7XG4gICAgICAgICAgICBTZXNzaW9uLmNyZWF0ZShkYXRhLmlkLCBkYXRhLnVzZXIpO1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KEFVVEhfRVZFTlRTLmxvZ2luU3VjY2Vzcyk7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLnVzZXIgPSBkYXRhLnVzZXI7XG4gICAgICAgICAgICByZXR1cm4gZGF0YS51c2VyO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXNlcyB0aGUgc2Vzc2lvbiBmYWN0b3J5IHRvIHNlZSBpZiBhblxuICAgICAgICAvLyBhdXRoZW50aWNhdGVkIHVzZXIgaXMgY3VycmVudGx5IHJlZ2lzdGVyZWQuXG4gICAgICAgIHRoaXMuaXNBdXRoZW50aWNhdGVkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICEhU2Vzc2lvbi51c2VyO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuZ2V0TG9nZ2VkSW5Vc2VyID0gZnVuY3Rpb24gKGZyb21TZXJ2ZXIpIHtcblxuICAgICAgICAgICAgLy8gSWYgYW4gYXV0aGVudGljYXRlZCBzZXNzaW9uIGV4aXN0cywgd2VcbiAgICAgICAgICAgIC8vIHJldHVybiB0aGUgdXNlciBhdHRhY2hlZCB0byB0aGF0IHNlc3Npb25cbiAgICAgICAgICAgIC8vIHdpdGggYSBwcm9taXNlLiBUaGlzIGVuc3VyZXMgdGhhdCB3ZSBjYW5cbiAgICAgICAgICAgIC8vIGFsd2F5cyBpbnRlcmZhY2Ugd2l0aCB0aGlzIG1ldGhvZCBhc3luY2hyb25vdXNseS5cblxuICAgICAgICAgICAgLy8gT3B0aW9uYWxseSwgaWYgdHJ1ZSBpcyBnaXZlbiBhcyB0aGUgZnJvbVNlcnZlciBwYXJhbWV0ZXIsXG4gICAgICAgICAgICAvLyB0aGVuIHRoaXMgY2FjaGVkIHZhbHVlIHdpbGwgbm90IGJlIHVzZWQuXG5cbiAgICAgICAgICAgIGlmICh0aGlzLmlzQXV0aGVudGljYXRlZCgpICYmIGZyb21TZXJ2ZXIgIT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJHEud2hlbihTZXNzaW9uLnVzZXIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBNYWtlIHJlcXVlc3QgR0VUIC9zZXNzaW9uLlxuICAgICAgICAgICAgLy8gSWYgaXQgcmV0dXJucyBhIHVzZXIsIGNhbGwgb25TdWNjZXNzZnVsTG9naW4gd2l0aCB0aGUgcmVzcG9uc2UuXG4gICAgICAgICAgICAvLyBJZiBpdCByZXR1cm5zIGEgNDAxIHJlc3BvbnNlLCB3ZSBjYXRjaCBpdCBhbmQgaW5zdGVhZCByZXNvbHZlIHRvIG51bGwuXG4gICAgICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KCcvc2Vzc2lvbicpLnRoZW4ob25TdWNjZXNzZnVsTG9naW4pLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5sb2dpbiA9IGZ1bmN0aW9uIChjcmVkZW50aWFscykge1xuICAgICAgICAgICAgcmV0dXJuICRodHRwLnBvc3QoJy9sb2dpbicsIGNyZWRlbnRpYWxzKVxuICAgICAgICAgICAgICAgIC50aGVuKG9uU3VjY2Vzc2Z1bExvZ2luKVxuICAgICAgICAgICAgICAgIC5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAkcS5yZWplY3QoeyBtZXNzYWdlOiAnSW52YWxpZCBsb2dpbiBjcmVkZW50aWFscy4nIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMubG9nb3V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICRodHRwLmdldCgnL2xvZ291dCcpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIFNlc3Npb24uZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdChBVVRIX0VWRU5UUy5sb2dvdXRTdWNjZXNzKTtcbiAgICAgICAgICAgICAgICAkcm9vdFNjb3BlLnVzZXIgPSBudWxsO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICB9KTtcblxuICAgIGFwcC5zZXJ2aWNlKCdTZXNzaW9uJywgZnVuY3Rpb24gKCRyb290U2NvcGUsIEFVVEhfRVZFTlRTKSB7XG5cbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLm5vdEF1dGhlbnRpY2F0ZWQsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHNlbGYuZGVzdHJveSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5zZXNzaW9uVGltZW91dCwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgc2VsZi5kZXN0cm95KCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuaWQgPSBudWxsO1xuICAgICAgICB0aGlzLnVzZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuY3JlYXRlID0gZnVuY3Rpb24gKHNlc3Npb25JZCwgdXNlcikge1xuICAgICAgICAgICAgdGhpcy5pZCA9IHNlc3Npb25JZDtcbiAgICAgICAgICAgIHRoaXMudXNlciA9IHVzZXI7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5pZCA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLnVzZXIgPSBudWxsO1xuICAgICAgICB9O1xuXG4gICAgfSk7XG5cbn0pKCk7XG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdob21lJywge1xuICAgICAgICB1cmw6ICcvJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9ob21lL2hvbWUuaHRtbCcsXG4gICAgICAgIC8vc2V0dGluZyBjb250cm9sbGVyIGZvciBob21lXG4gICAgICAgIGNvbnRyb2xsZXI6IGZ1bmN0aW9uKCRzY29wZSwgdG9waWNzLCBwcmVyZXFzLCBUb3BpY0ZhY3Rvcnkpe1xuICAgICAgICBcdCRzY29wZS50b3BpY3MgPSB0b3BpY3M7XG4gICAgICAgIFx0JHNjb3BlLnByZXJlcXMgPSBwcmVyZXFzO1xuXG4gICAgICAgIH0sXG4gICAgICAgIC8vcmVzb2x2aW5nIGxpc3Qgb2YgdG9waWNzIGFuZCBwcmVyZXFzIHRvIHNvbHZlIEFzeW5jIGlzc3VlXG4gICAgICAgIC8vbGlzdCBvZiB0b3BpY3MgYW5kIHByZXJlcXMgYXZhaWxhYmxlIG9uIGhvbWUgaHRtbFxuICAgICAgICByZXNvbHZlOntcbiAgICAgICAgXHR0b3BpY3M6IGZ1bmN0aW9uKFRvcGljRmFjdG9yeSl7XG4gICAgICAgIFx0XHRyZXR1cm4gVG9waWNGYWN0b3J5LmZldGNoQWxsKCk7XG4gICAgICAgIFx0fSxcbiAgICAgICAgXHRwcmVyZXFzOiBmdW5jdGlvbihQcmVyZXFGYWN0b3J5KXtcbiAgICAgICAgXHRcdHJldHVybiBQcmVyZXFGYWN0b3J5LmZldGNoQWxsKCk7XG4gICAgICAgIFx0fVxuICAgICAgICB9XG4gICAgfSk7XG59KTsiLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuXG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ2xvZ2luJywge1xuICAgICAgICB1cmw6ICcvbG9naW4nLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2xvZ2luL2xvZ2luLmh0bWwnLFxuICAgICAgICBjb250cm9sbGVyOiAnTG9naW5DdHJsJ1xuICAgIH0pO1xuXG59KTtcblxuYXBwLmNvbnRyb2xsZXIoJ0xvZ2luQ3RybCcsIGZ1bmN0aW9uICgkc2NvcGUsIEF1dGhTZXJ2aWNlLCAkc3RhdGUpIHtcblxuICAgICRzY29wZS5sb2dpbiA9IHt9O1xuICAgICRzY29wZS5lcnJvciA9IG51bGw7XG5cbiAgICAkc2NvcGUuc2VuZExvZ2luID0gZnVuY3Rpb24gKGxvZ2luSW5mbykge1xuICAgICAgICAkc2NvcGUuZXJyb3IgPSBudWxsO1xuXG4gICAgICAgIEF1dGhTZXJ2aWNlLmxvZ2luKGxvZ2luSW5mbykudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAkc3RhdGUuZ28oJ2hvbWUnKTtcbiAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgJHNjb3BlLmVycm9yID0gJ0ludmFsaWQgbG9naW4gY3JlZGVudGlhbHMuJztcbiAgICAgICAgfSk7XG5cbiAgICB9O1xuXG59KTsiLCIndXNlIHN0cmljdCc7XG5cbmFwcC5kaXJlY3RpdmUoJ29hdXRoQnV0dG9uJywgZnVuY3Rpb24gKCkge1xuICByZXR1cm4ge1xuICAgICAgc2NvcGU6IHtcbiAgICAgICAgICAgIHByb3ZpZGVyTmFtZTogJ0AnXG4gICAgICAgICAgfSxcbiAgICAgIHJlc3RyaWN0OiAnRScsXG4gICAgICB0ZW1wbGF0ZVVybDogJy9qcy9vYXV0aC9vYXV0aC1idXR0b24uaHRtbCdcbiAgICB9XG59KTtcblxuYXBwLmRpcmVjdGl2ZSgnb2F1dGgnLCBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB7XG4gICAgICByZXN0cmljdDogJ0UnLFxuICAgICAgdGVtcGxhdGVVcmw6ICcvanMvb2F1dGgvb2F1dGguaHRtbCdcbiAgICB9XG59KTsiLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdwbGFucycsIHtcbiAgICAgICAgdXJsOiAnL3BsYW5zJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9wbGFucy9wbGFucy5odG1sJyxcbiAgICAgICAgY29udHJvbGxlcjogJ1BsYW5zQ3RybCcsXG4gICAgICAgIHJlc29sdmU6IHtcbiAgICAgICAgICAgIHBsYW5zOiBmdW5jdGlvbihQbGFuRmFjdG9yeSwgJHJvb3RTY29wZSwgQXV0aFNlcnZpY2UpIHtcbiAgICAgICAgICAgICAgaWYoISRyb290U2NvcGUudXNlcikgeyAvLyBuZWNlc3NhcnkgaWYgYSB1c2VyIHJlbG9hZHMgdGhlIHBsYW4gcGFnZVxuICAgICAgICAgICAgICAgIHJldHVybiBBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKVxuICAgICAgICAgICAgICAgIC50aGVuKCBmdW5jdGlvbih1c2VyKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gUGxhbkZhY3RvcnkuZmV0Y2hQbGFuc0J5VXNlcih1c2VyLmlkKVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFBsYW5GYWN0b3J5LmZldGNoUGxhbnNCeVVzZXIoJHJvb3RTY29wZS51c2VyLmlkKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbn0pO1xuXG5hcHAuY29udHJvbGxlcignUGxhbnNDdHJsJywgZnVuY3Rpb24oJHNjb3BlLCBQbGFuRmFjdG9yeSwgcGxhbnMsICRyb290U2NvcGUsICR1aWJNb2RhbCwgVG9waWNGYWN0b3J5LCAkc3RhdGUpe1xuXG4gICRzY29wZS5wbGFucyA9IHBsYW5zO1xuXG4gIHZhciB1c2VySWQ7XG4gIGlmKCRyb290U2NvcGUudXNlcikgdXNlcklkID0gJHJvb3RTY29wZS51c2VyLmlkO1xuXG4gICRyb290U2NvcGUuJG9uKCdkZWxldGUtcGxhbicsIGZ1bmN0aW9uKGV2ZW50LCBkYXRhKXtcbiAgICBQbGFuRmFjdG9yeS5yZW1vdmVQbGFuKGRhdGEucGxhbklkKVxuICAgIC50aGVuKGZ1bmN0aW9uKCl7XG4gICAgICByZXR1cm4gUGxhbkZhY3RvcnkuZmV0Y2hQbGFuc0J5VXNlcih1c2VySWQpXG4gICAgfSlcbiAgICAudGhlbihmdW5jdGlvbihwbGFucyl7XG4gICAgICAkc2NvcGUucGxhbnMgPSBwbGFucztcbiAgICB9KVxuICB9KVxuXG4gICRzY29wZS5zaG93UGxhbiA9IGZ1bmN0aW9uKHBsYW5JZCkge1xuICAgICQoJyNwbGFuLW5hdi0nICsgcGxhbklkKS5zaWJsaW5ncygpLnJlbW92ZUNsYXNzKCdhY3RpdmUnKTtcbiAgICAkKCcjcGxhbi1uYXYtJyArIHBsYW5JZCkuYWRkQ2xhc3MoJ2FjdGl2ZScpO1xuICAgICRzY29wZS5jdXJyZW50UGxhbiA9ICRzY29wZS5wbGFuc1tnZXRQbGFuQnlJZChwbGFuSWQpXTtcbiAgfVxuICAvLyBzaG93IGZpcnN0IHBsYW4gYnkgZGVmYXVsdFxuICBpZigkc2NvcGUucGxhbnMubGVuZ3RoID4gMCkgJHNjb3BlLnNob3dQbGFuKCRzY29wZS5wbGFuc1swXS5pZCk7XG5cbiAgJHNjb3BlLmFkZE5ld1BsYW4gPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgYWRkUGxhbk1vZGFsID0gJHVpYk1vZGFsLm9wZW4oe1xuICAgICAgYW5pbWF0aW9uOiB0cnVlLFxuICAgICAgdGVtcGxhdGVVcmw6ICcuL2pzL2NvbW1vbi9tb2RhbHMvdmlld3MvYWRkUGxhbi5odG1sJyxcbiAgICAgIGNvbnRyb2xsZXI6ICdBZGRQbGFuTW9kYWxDdHJsJyxcbiAgICAgIHJlc29sdmU6IHtcbiAgICAgICAgdG9waWNzOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gVG9waWNGYWN0b3J5LmZldGNoQWxsKCk7XG4gICAgICAgIH0sXG4gICAgICAgIG9wdGlvbnM6IHt9LFxuICAgICAgICByZXNvdXJjZXM6IG51bGxcbiAgICAgIH1cbiAgICB9KTtcbiAgICBhZGRQbGFuTW9kYWwucmVzdWx0XG4gICAgLnRoZW4oZnVuY3Rpb24gKG5ld1BsYW4pIHtcbiAgICAgICRzY29wZS5wbGFucy5wdXNoKG5ld1BsYW4pO1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0UGxhbkJ5SWQoaWQpIHtcbiAgICBmb3IodmFyIGk9MDsgaTwkc2NvcGUucGxhbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmKCRzY29wZS5wbGFuc1tpXS5pZCA9PT0gaWQpIHJldHVybiBpO1xuICAgIH1cbiAgfVxuXG4gIC8vICRzY29wZS5yZW1vdmVQbGFuID0gZnVuY3Rpb24oaWQpIHtcbiAgLy8gICAgIFBsYW5GYWN0b3J5LnJlbW92ZVBsYW4oaWQpLnRoZW4oZnVuY3Rpb24oKSB7XG4gIC8vICAgICAgICAgcmV0dXJuIFBsYW5GYWN0b3J5LmZldGNoUGxhbnNCeVVzZXIodXNlcklkKVxuICAvLyAgICAgfSlcbiAgLy8gICAgIC50aGVuKGZ1bmN0aW9uKFBsYW5zKSB7ICRzY29wZS51c2VyUGxhbnMgPSBQbGFuczsgfSk7XG4gIC8vIH07XG4gIC8vXG4gIC8vICRzY29wZS5yZW1vdmVGcm9tUGxhbiA9IGZ1bmN0aW9uKHBsYW5JZCwgcmVzb3VyY2VJZCl7XG4gIC8vICAgICBQbGFuRmFjdG9yeS5yZW1vdmVSZXNvdXJjZUZyb21QbGFuKHBsYW5JZCwgcmVzb3VyY2VJZClcbiAgLy8gICAgIC50aGVuKGZ1bmN0aW9uKCl7XG4gIC8vICAgICAgICAgcmV0dXJuIFBsYW5GYWN0b3J5LmZldGNoUGxhbnNCeVVzZXIodXNlcklkKVxuICAvLyAgICAgfSlcbiAgLy8gICAgIC50aGVuKGZ1bmN0aW9uKFBsYW5zKXtcbiAgLy8gICAgICAgICAkc2NvcGUudXNlclBsYW5zID0gUGxhbnNcbiAgLy8gICAgIH0pO1xuICAvLyB9XG4gIC8vXG4gIC8vICRzY29wZS5tb3ZlVXAgPSBmdW5jdGlvbihwbGFuLCByZXNvdXJjZUlkKXtcbiAgLy8gICAgIHZhciByQXJyID0gcGxhbi5yZXNvdXJjZXM7XG4gIC8vXG4gIC8vICAgICBmb3IodmFyIGkgPSAxOyBpIDwgckFyci5sZW5ndGg7IGkrKyl7XG4gIC8vXG4gIC8vICAgICAgICAgICBpZihyQXJyW2ldLmlkID09PSByZXNvdXJjZUlkKXtcbiAgLy8gICAgICAgICAgICAgdmFyIHRlbXAgPSByQXJyW2ldO1xuICAvLyAgICAgICAgICAgICByQXJyW2ldID0gckFycltpLTFdO1xuICAvLyAgICAgICAgICAgICByQXJyW2ktMV0gPSB0ZW1wO1xuICAvLyAgICAgICAgICAgfVxuICAvL1xuICAvLyAgICAgfVxuICAvLyB9XG4gIC8vXG4gIC8vICRzY29wZS5tb3ZlRG93biA9IGZ1bmN0aW9uKHBsYW4sIHJlc291cmNlSWQpe1xuICAvLyAgICAgdmFyIHJBcnIgPSBwbGFuLnJlc291cmNlcztcbiAgLy9cbiAgLy8gICAgIGZvcih2YXIgaSA9IDA7IGkgPCByQXJyLmxlbmd0aC0xOyBpKyspe1xuICAvLyAgICAgICAgICAgaWYockFycltpXS5pZCA9PT0gcmVzb3VyY2VJZCl7XG4gIC8vICAgICAgICAgICAgIHZhciB0ZW1wID0gckFycltpXTtcbiAgLy8gICAgICAgICAgICAgckFycltpXSA9IHJBcnJbaSsxXTtcbiAgLy8gICAgICAgICAgICAgckFycltpKzFdID0gdGVtcDtcbiAgLy8gICAgICAgICAgICAgYnJlYWs7XG4gIC8vICAgICAgICAgICB9XG4gIC8vICAgICB9XG4gIC8vIH1cblxufSlcbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG5cbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnc2lnbnVwJywge1xuICAgICAgICB1cmw6ICcvc2lnbnVwJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9zaWdudXAvc2lnbnVwLmh0bWwnLFxuICAgICAgICBjb250cm9sbGVyOiAnU2lnbnVwQ3RybCdcbiAgICB9KTtcblxufSk7XG5cbmFwcC5jb250cm9sbGVyKCdTaWdudXBDdHJsJywgZnVuY3Rpb24gKCRzY29wZSwgU2lnbnVwRmFjdG9yeSwgJHN0YXRlKSB7XG4gICRzY29wZS5lcnJvciA9IG51bGw7XG4gICRzY29wZS5zaWdudXAgPSBmdW5jdGlvbigpIHtcbiAgICBTaWdudXBGYWN0b3J5LmNyZWF0ZVVzZXIoJHNjb3BlLm5ld1VzZXIpXG4gICAgLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICRzdGF0ZS5nbygnaG9tZScpO1xuICAgIH0pXG4gICAgLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAkc2NvcGUuZXJyb3IgPSBlcnIuZGF0YTtcbiAgICB9KTtcbiAgfVxufSk7XG4iLCJhcHAuY29udHJvbGxlcignVG9waWNDdHJsJywgZnVuY3Rpb24gKCRzY29wZSwgJHJvb3RTY29wZSwgJHVpYk1vZGFsLCAkbG9nLCBUb3BpY0ZhY3RvcnksIHRvcGljLCBwbGFucywgdm90ZXMpIHtcbiAgJHNjb3BlLnRvcGljID0gdG9waWM7XG4gICRzY29wZS50b3BpYy5wbGFucyA9IHBsYW5zO1xuICAkc2NvcGUudG9waWMudm90ZXMgPSB2b3RlcztcbiAgc29ydEFsbCgpO1xuXG4gIC8vIGdldCBjdXJyZW50IHVzZXIgSUQgLSB1c2VkIHRvIGRldGVybWluZSB3aGV0aGVyIGEgdXNlciBoYXMgdm90ZWRcbiAgdmFyIHVzZXJJZDtcbiAgaWYoJHJvb3RTY29wZS51c2VyKSB1c2VySWQgPSAkcm9vdFNjb3BlLnVzZXIuaWQ7XG4gIC8vIGlzTG9nZ2VkSW4gPSB0cnVlIGlzIHVzZXIgaXMgbG9nZ2VkIGluOyBpLmUuLCB0aGVyZSBpcyBhIHVzZXIgb24gdGhlICRyb290U2NvcGVcbiAgJHNjb3BlLmlzTG9nZ2VkSW4gPSB1c2VySWQgPj0gMDtcblxuICAvL3NwbGl0IGFycmF5IG9mIHByZXJlcVRvcGljcyBpbnRvIHNtYWxsZXIgY2h1bmtzIG9mIDMgYW5kIHB1dCB0aGVtIGludG8gdGhlc2UgdHdvIGFycmF5c1xuICAkc2NvcGUuY2h1bmtQcmVyZXFzPSBbXTtcbiAgJHNjb3BlLmNodW5rU3ViVG9wcz0gW107XG5cbiAgZnVuY3Rpb24gYnVpbGRUb3BpY0NodW5rcygpe1xuICAgIHZhciBzaXplID0gMztcbiAgICB2YXIgcHJlUmVxcz0gJHNjb3BlLnRvcGljLnByZXJlcVRvcGljcy5zbGljZSgpO1xuICAgIHZhciBzdWJUb3BzPSAkc2NvcGUudG9waWMuc3Vic2VxVG9waWNzLnNsaWNlKCk7XG4gICAgdmFyIGNvdW50ZXI9IDA7XG4gICAgdmFyIHRvcGljc0xlZnQ9IHRydWU7XG4gICAgJHNjb3BlLmNodW5rUHJlcmVxcz0gW107XG4gICAgJHNjb3BlLmNodW5rU3ViVG9wcz0gW107XG5cbiAgICB3aGlsZShwcmVSZXFzLmxlbmd0aCB8fCBzdWJUb3BzLmxlbmd0aCl7XG4gICAgICBpZihwcmVSZXFzLmxlbmd0aCkgJHNjb3BlLmNodW5rUHJlcmVxcy5wdXNoKHByZVJlcXMuc3BsaWNlKDAsIHNpemUpKTtcbiAgICAgIGlmKHN1YlRvcHMubGVuZ3RoKSAkc2NvcGUuY2h1bmtTdWJUb3BzLnB1c2goc3ViVG9wcy5zcGxpY2UoMCwgc2l6ZSkpO1xuICAgIH1cblxuICB9XG5cbiAgYnVpbGRUb3BpY0NodW5rcygpO1xuXG5cblxuICAvLyBTdWdnZXN0IHJlbGF0ZWQgdG9waWNzIChpLmUuLCBwcmVyZXF1aXNpdGVzIG9yIHN1YnNlcXVlbnQgdG9waWNzKVxuICAkc2NvcGUuc3VnZ2VzdFJlbGF0ZWRUb3BpYyA9IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuICAgIGlmKG9wdGlvbnMuc3VnZ2VzdGlvblR5cGUgPT09ICdwcmVyZXEnKSB7XG4gICAgICBvcHRpb25zLmZvcm1UaXRsZSA9IFwiQWRkIGEgcHJlcmVxdWlzaXRlIHRvIFwiICsgJHNjb3BlLnRvcGljLnRpdGxlO1xuICAgIH0gZWxzZSBpZihvcHRpb25zLnN1Z2dlc3Rpb25UeXBlID09PSAnc3Vic2VxJykge1xuICAgICAgb3B0aW9ucy5mb3JtVGl0bGUgPSBcIlN1Z2dlc3QgYSBuZXh0IHRvcGljIGZvciBcIiArICRzY29wZS50b3BpYy50aXRsZTtcbiAgICB9XG4gICAgdmFyIHN1Z2dlc3RUb3BpY01vZGFsID0gJHVpYk1vZGFsLm9wZW4oe1xuICAgICAgYW5pbWF0aW9uOiB0cnVlLFxuICAgICAgdGVtcGxhdGVVcmw6ICdqcy9jb21tb24vbW9kYWxzL3ZpZXdzL3N1Z2dlc3RUb3BpYy5odG1sJyxcbiAgICAgIGNvbnRyb2xsZXI6ICdTdWdnZXN0VG9waWNNb2RhbEN0cmwnLFxuICAgICAgcmVzb2x2ZToge1xuICAgICAgICBvcHRpb25zOiBvcHRpb25zLFxuICAgICAgICB0b3BpY3M6IFRvcGljRmFjdG9yeS5mZXRjaEFsbCgpXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBzdWdnZXN0VG9waWNNb2RhbC5yZXN1bHRcbiAgICAudGhlbihmdW5jdGlvbiAocmVzdWx0cykge1xuICAgICAgdmFyIHR5cGUgPSByZXN1bHRzWzBdLFxuICAgICAgICAgIHN1Z2dlc3RlZFRvcGljID0gcmVzdWx0c1sxXTtcbiAgICAgIC8vIHVwZGF0ZSBET01cbiAgICAgIGlmKHR5cGUgPT09ICdwcmVyZXEnKSB7XG4gICAgICAgICRzY29wZS50b3BpYy5wcmVyZXFUb3BpY3MucHVzaCggc3VnZ2VzdGVkVG9waWMgKTtcbiAgICAgIH0gZWxzZSBpZih0eXBlID09PSAnc3Vic2VxJyl7XG4gICAgICAgICRzY29wZS50b3BpYy5zdWJzZXFUb3BpY3MucHVzaCggc3VnZ2VzdGVkVG9waWMgKTtcbiAgICAgIH1cbiAgICAgIGJ1aWxkVG9waWNDaHVua3MoKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIEZMQUdHSU5HXG4gICRzY29wZS5mbGFnVG9waWMgPSBmdW5jdGlvbihpZCkge1xuICAgICR1aWJNb2RhbC5vcGVuKHtcbiAgICAgIGFuaW1hdGlvbjogdHJ1ZSxcbiAgICAgIHRlbXBsYXRlVXJsOiAnLi9qcy9jb21tb24vbW9kYWxzL3ZpZXdzL2FkZEZsYWdNb2RhbC5odG1sJyxcbiAgICAgIGNvbnRyb2xsZXI6ICdBZGRGbGFnTW9kYWxJbnN0YW5jZUN0cmwnLFxuICAgICAgcmVzb2x2ZToge1xuICAgICAgICBvcHRpb25zOiB7IHR5cGU6ICd0b3BpYycsIGlkOiBpZCB9XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvLyBBREQgTkVXIFJFU09VUkNFXG4gICRzY29wZS5hZGROZXdSZXNvdXJjZSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBhZGRSZXNvdXJjZU1vZGFsID0gJHVpYk1vZGFsLm9wZW4oe1xuICAgICAgYW5pbWF0aW9uOiB0cnVlLFxuICAgICAgdGVtcGxhdGVVcmw6ICcuL2pzL2NvbW1vbi9tb2RhbHMvdmlld3MvYWRkUmVzb3VyY2UuaHRtbCcsXG4gICAgICBjb250cm9sbGVyOiAnQWRkUmVzb3VyY2VNb2RhbEN0cmwnLFxuICAgICAgcmVzb2x2ZToge1xuICAgICAgICBvcHRpb25zOiB7IHRvcGljSWQ6ICRzY29wZS50b3BpYy5pZCwgdG9waWNOYW1lOiAkc2NvcGUudG9waWMudGl0bGUgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIGFkZFJlc291cmNlTW9kYWwucmVzdWx0XG4gICAgLnRoZW4oZnVuY3Rpb24gKG5ld1Jlc291cmNlKSB7XG4gICAgICAkc2NvcGUudG9waWMucmVzb3VyY2VzLnB1c2gobmV3UmVzb3VyY2UpO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gQUREIE5FVyBQTEFOXG4gICRzY29wZS5hZGROZXdQbGFuID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGFkZFBsYW5Nb2RhbCA9ICR1aWJNb2RhbC5vcGVuKHtcbiAgICAgIGFuaW1hdGlvbjogdHJ1ZSxcbiAgICAgIHRlbXBsYXRlVXJsOiAnLi9qcy9jb21tb24vbW9kYWxzL3ZpZXdzL2FkZFBsYW4uaHRtbCcsXG4gICAgICBjb250cm9sbGVyOiAnQWRkUGxhbk1vZGFsQ3RybCcsXG4gICAgICByZXNvbHZlOiB7XG4gICAgICAgIG9wdGlvbnM6IHsgdG9waWNJZDogJHNjb3BlLnRvcGljLmlkLCB0b3BpY05hbWU6ICRzY29wZS50b3BpYy50aXRsZSB9LFxuICAgICAgICB0b3BpY3M6IG51bGwsXG4gICAgICAgIHJlc291cmNlczogZnVuY3Rpb24oKSB7IHJldHVybiAkc2NvcGUudG9waWMucmVzb3VyY2VzIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgICBhZGRQbGFuTW9kYWwucmVzdWx0XG4gICAgLnRoZW4oZnVuY3Rpb24gKG5ld1BsYW4pIHtcbiAgICAgICRzY29wZS50b3BpYy5wbGFucy5wdXNoKG5ld1BsYW4pO1xuICAgIH0pO1xuICB9XG5cbiAgJHJvb3RTY29wZS4kb24oJ3ZvdGVkLW5lZWQtcmVzb3J0JywgZnVuY3Rpb24oZXZlbnQsIGRhdGEpIHtcblxuICAgICRzY29wZS50b3BpYy52b3Rlc1tkYXRhLnR5cGVdW2RhdGEuaWRdID0gZGF0YS52b3RlcztcbiAgICBzb3J0KGRhdGEudHlwZSk7XG4gICAgYnVpbGRUb3BpY0NodW5rcygpO1xuXG4gIH0pXG5cbiAgLy8gREFUQSBTT1JUSU5HXG4gIC8vIFNvcnQgbWFzdGVyIHJvdXRpbmcgZnVuY3Rpb25cbiAgZnVuY3Rpb24gc29ydCh0eXBlKSB7XG4gICAgc3dpdGNoKHR5cGUpIHtcbiAgICAgIGNhc2UgJ3Jlc291cmNlcyc6XG4gICAgICAgICRzY29wZS50b3BpYy5yZXNvdXJjZXMgPSBUb3BpY0ZhY3Rvcnkuc29ydERhdGEoJHNjb3BlLnRvcGljLnJlc291cmNlcywgJHNjb3BlLnRvcGljLnZvdGVzLnJlc291cmNlcywgJ2lkJyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAncHJlcmVxJzpcbiAgICAgICAgJHNjb3BlLnRvcGljLnByZXJlcVRvcGljcyA9IFRvcGljRmFjdG9yeS5zb3J0RGF0YSgkc2NvcGUudG9waWMucHJlcmVxVG9waWNzLCAkc2NvcGUudG9waWMudm90ZXMucHJlcmVxLCAncHJlcmVxdWlzaXRlSWQnKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdzdWJzZXEnOlxuICAgICAgICAkc2NvcGUudG9waWMuc3Vic2VxVG9waWNzID0gVG9waWNGYWN0b3J5LnNvcnREYXRhKCRzY29wZS50b3BpYy5zdWJzZXFUb3BpY3MsICRzY29wZS50b3BpYy52b3Rlcy5zdWJzZXEsICd0b3BpY0lkJyk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHNvcnRBbGwoKSB7XG4gICAgc29ydCgncmVzb3VyY2VzJyk7XG4gICAgc29ydCgncHJlcmVxJyk7XG4gICAgc29ydCgnc3Vic2VxJyk7XG4gIH1cblxufSk7XG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuXG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ3RvcGljJywge1xuICAgICAgICB1cmw6ICcvdG9waWMvOnRvcGljSWQnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL3RvcGljcy90b3BpYy5odG1sJyxcbiAgICAgICAgY29udHJvbGxlcjogJ1RvcGljQ3RybCcsXG4gICAgICAgIHJlc29sdmU6IHtcbiAgICAgICAgICB0b3BpYzogZnVuY3Rpb24oVG9waWNGYWN0b3J5LCAkc3RhdGVQYXJhbXMpIHtcbiAgICAgICAgICAgIHJldHVybiBUb3BpY0ZhY3RvcnkuZmV0Y2hCeUlkKCRzdGF0ZVBhcmFtcy50b3BpY0lkKTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIHBsYW5zOiBmdW5jdGlvbihQbGFuRmFjdG9yeSwgJHN0YXRlUGFyYW1zKSB7XG4gICAgICAgICAgICByZXR1cm4gUGxhbkZhY3RvcnkuZmV0Y2hQbGFuc0J5VG9waWMoJHN0YXRlUGFyYW1zLnRvcGljSWQpO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgdm90ZXM6IGZ1bmN0aW9uKFZvdGVGYWN0b3J5LCB0b3BpYykge1xuICAgICAgICAgICAgcmV0dXJuIFZvdGVGYWN0b3J5LmdldFByb2Nlc3NlZFZvdGVzKHRvcGljKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcblxufSk7XG4iLCIvLyBTdGF0ZSAmIENvbnRyb2xsZXIgZm9yIGFsbCB0b3BpY3NcblxuYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcblxuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCd0b3BpY3MnLCB7XG4gICAgICAgIHVybDogJy90b3BpY3MnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL3RvcGljcy90b3BpY3MuaHRtbCcsXG4gICAgICAgIGNvbnRyb2xsZXI6ICdUb3BpY3NDdHJsJyxcbiAgICAgICAgcGFyYW1zOiB7ICdkZWZhdWx0U2VhcmNoJzogbnVsbCB9LFxuICAgICAgICByZXNvbHZlOiB7XG4gICAgICAgICAgdG9waWNzOiBmdW5jdGlvbihUb3BpY0ZhY3RvcnkpIHtcbiAgICAgICAgICAgIHJldHVybiBUb3BpY0ZhY3RvcnkuZmV0Y2hBbGwoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcblxufSk7XG5cbmFwcC5jb250cm9sbGVyKCdUb3BpY3NDdHJsJywgZnVuY3Rpb24gKCRzY29wZSwgVG9waWNGYWN0b3J5LCB0b3BpY3MsICR1aWJNb2RhbCwgJHN0YXRlUGFyYW1zKSB7XG5cbiAgJHNjb3BlLnRvcGljcyA9IHRvcGljcztcbiAgJHNjb3BlLnNlYXJjaFRleHQgPSAkc3RhdGVQYXJhbXMuZGVmYXVsdFNlYXJjaDtcblxuICAvLyBBREQgVE9QSUNcbiAgJHNjb3BlLmFkZFRvcGljID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGFkZFRvcGljTW9kYWwgPSAkdWliTW9kYWwub3Blbih7XG4gICAgICBhbmltYXRpb246IHRydWUsXG4gICAgICB0ZW1wbGF0ZVVybDogJy4vanMvY29tbW9uL21vZGFscy92aWV3cy9hZGRUb3BpYy5odG1sJyxcbiAgICAgIGNvbnRyb2xsZXI6ICdBZGRUb3BpY01vZGFsQ3RybCdcbiAgICB9KTtcbiAgICBhZGRUb3BpY01vZGFsLnJlc3VsdFxuICAgIC50aGVuKGZ1bmN0aW9uIChuZXdUb3BpYykge1xuICAgICAgJHNjb3BlLnRvcGljcy5wdXNoKG5ld1RvcGljKTtcbiAgICB9KTtcbiAgfVxuXG59KTtcbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG5cbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgndXNlclByb2ZpbGUnLCB7XG4gICAgICAgIHVybDogJy91c2VyJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy91c2VyUHJvZmlsZS91c2VyLXByb2ZpbGUuaHRtbCcsXG4gICAgICAgIGNvbnRyb2xsZXI6ICdVc2VyUHJvZmlsZUN0cmwnLFxuICAgICAgICByZXNvbHZlOiB7XG4gICAgICAgICAgICBjdXJyZW50VXNlcjogZnVuY3Rpb24oQXV0aFNlcnZpY2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gQXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVzb3VyY2VzOiBbJ2N1cnJlbnRVc2VyJywgJ1Jlc291cmNlRmFjdG9yeScsIGZ1bmN0aW9uKGN1cnJlbnRVc2VyLCBSZXNvdXJjZUZhY3RvcnkpIHsgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBSZXNvdXJjZUZhY3RvcnkuZmV0Y2hCeVVzZXIoY3VycmVudFVzZXIuaWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAudGhlbihyZXNvdXJjZXMgPT4gcmVzb3VyY2VzKTtcbiAgICAgICAgICAgIH1dXG4gICAgICAgIH1cbiAgICB9KTtcbn0pO1xuXG5hcHAuY29udHJvbGxlcignVXNlclByb2ZpbGVDdHJsJywgZnVuY3Rpb24gKCRzY29wZSwgVXNlcnNGYWN0b3J5LCBQbGFuRmFjdG9yeSwgY3VycmVudFVzZXIsIHJlc291cmNlcykge1xuXG4gICAgZnVuY3Rpb24gY2xvbmVPYmoob2JqKSB7IHJldHVybiBPYmplY3QuYXNzaWduKHt9LCBvYmopIH07XG5cblx0JHNjb3BlLmVycm9yID0gbnVsbDtcblx0JHNjb3BlLnB3VXBkYXRlID0gbnVsbDtcblx0JHNjb3BlLnB3Q2hlY2sgPSBudWxsO1xuICAgICRzY29wZS51c2VyVXBkYXRlID0gY2xvbmVPYmooY3VycmVudFVzZXIpO1xuICAgICAgICAkc2NvcGUucmVzb3VyY2VzID0gcmVzb3VyY2VzO1xuXHQkc2NvcGUudXBkYXRlVXNlciA9IGZ1bmN0aW9uKHVwZGF0ZWRJbmZvKSB7XG5cdFx0aWYoJHNjb3BlLnB3VXBkYXRlICE9PSAkc2NvcGUucHdDaGVjaykge1xuXHRcdFx0JHNjb3BlLmVycm9yID0gXCJQYXNzd29yZCBkb2VzIG5vdCBtYXRjaCBjb25maXJtYXRpb24hXCI7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0JHNjb3BlLmVycm9yID0gbnVsbDtcblx0XHRcdGlmKCRzY29wZS5wd1VwZGF0ZSAhPT0gbnVsbCkgdXBkYXRlZEluZm8ucGFzc3dvcmQgPSAkc2NvcGUucHdVcGRhdGU7XG5cdFx0XHRVc2Vyc0ZhY3RvcnkudXBkYXRlVXNlcih1cGRhdGVkSW5mbyk7XG5cdFx0fVxuXHR9XG5cblx0JHNjb3BlLnJlc2V0ID0gZnVuY3Rpb24oKSB7IFxuXHRcdCRzY29wZS51c2VyVXBkYXRlID0gY2xvbmVPYmooY3VycmVudFVzZXIpO1xuXHRcdCRzY29wZS5lcnJvciA9IG51bGw7XG5cdFx0JHNjb3BlLnB3VXBkYXRlID0gbnVsbDtcblx0XHQkc2NvcGUucHdDaGVjayA9IG51bGw7XG5cdH07XG5cbn0pO1xuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcblxuICAkc3RhdGVQcm92aWRlci5zdGF0ZSgndXNlcnMnLCB7XG4gICAgdXJsOiAnL3VzZXJzJyxcbiAgICB0ZW1wbGF0ZVVybDogJ2pzL3VzZXJzL3RlbXBsYXRlcy91c2Vycy5odG1sJyxcblxuICB9KVxuXG59KTtcbiIsIlxuYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcblxuICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnYWRtaW4udXNlcnMnLCB7XG4gICAgdXJsOiAnL3VzZXJzJyxcbiAgICB0ZW1wbGF0ZVVybDogJ2pzL3VzZXJzL3RlbXBsYXRlcy91c2Vycy5odG1sJyxcbiAgICBjb250cm9sbGVyOiBmdW5jdGlvbigkc2NvcGUsIHVzZXJzLCBVc2Vyc0ZhY3Rvcnkpe1xuICAgICAgJHNjb3BlLnVzZXJzPSB1c2VycztcblxuICAgICAgJHNjb3BlLmRlbGV0ZVVzZXI9IGZ1bmN0aW9uKHVzZXIpe1xuICAgICAgICBVc2Vyc0ZhY3RvcnkuZGVsZXRlVXNlcih1c2VyKVxuICAgICAgICAudGhlbihmdW5jdGlvbih1cGRhdGVkVXNlcnMpe1xuICAgICAgICAgICRzY29wZS51c2Vycz11cGRhdGVkVXNlcnM7XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICAkc2NvcGUudHJpZ2dlclBhc3N3b3JkUmVzZXQ9IGZ1bmN0aW9uKHVzZXIpe1xuICAgICAgICB1c2VyLnBhc3N3b3JkUmVzZXQ9IHRydWU7XG4gICAgICAgIFVzZXJzRmFjdG9yeS51cGRhdGVVc2VyKHVzZXIpO1xuXG4gICAgICB9O1xuXG4gICAgICAkc2NvcGUudXBkYXRlPSBVc2Vyc0ZhY3RvcnkudXBkYXRlVXNlcjtcbiAgICB9LFxuICAgIHJlc29sdmU6IHtcbiAgICAgIHVzZXJzOiBVc2Vyc0ZhY3RvcnkgPT4gVXNlcnNGYWN0b3J5LmdldEFsbFVzZXJzKCksXG4gICAgfVxuXG4gIH0pXG5cbn0pO1xuIiwiYXBwLmZhY3RvcnkoJ0ZsYWdGYWN0b3J5JywgZnVuY3Rpb24oJGh0dHApe1xuXHR2YXIgYmFzZVVybCA9ICcvYXBpL2ZsYWdzLyc7XG5cdHZhciBvYmo9IHtcblx0XHRmZXRjaFRvcGljRmxhZ3M6IGZ1bmN0aW9uKGlkKXtcblx0XHRcdHJldHVybiAkaHR0cC5nZXQoYmFzZVVybCArICd0b3BpYy8nKyBpZCApXG5cdFx0XHQudGhlbiggcmVzID0+IHJlcy5kYXRhKTtcblx0XHR9LFxuXHRcdGFkZFRvcGljRmxhZzogZnVuY3Rpb24oaWQsIGZsYWcpe1xuXHRcdFx0cmV0dXJuICRodHRwLnBvc3QoYmFzZVVybCArICd0b3BpYy8nKyBpZCwgZmxhZylcblx0XHRcdC50aGVuKCByZXMgPT4gcmVzLmRhdGEpXG5cdFx0XHQuY2F0Y2goZXJyID0+IGVyci5kYXRhKTtcblx0XHR9LFxuXHRcdGRlbGV0ZVRvcGljRmxhZzogZnVuY3Rpb24oZmxhZ0lkLCB0b3BpY0lkKXtcblx0XHRcdHJldHVybiAkaHR0cC5kZWxldGUoYmFzZVVybCArICd0b3BpYy8nKyBmbGFnSWQpXG5cdFx0XHQudGhlbiggKCkgPT4gb2JqLmZldGNoVG9waWNGbGFncyh0b3BpY0lkKSk7XG5cdFx0fSxcblx0XHRmZXRjaFJlc291cmNlRmxhZ3M6IGZ1bmN0aW9uKGlkKXtcblx0XHRcdHJldHVybiAkaHR0cC5nZXQoYmFzZVVybCArICdyZXNvdXJjZS8nKyBpZCApXG5cdFx0XHQudGhlbiggcmVzID0+IHJlcy5kYXRhKTtcblx0XHR9LFxuXHRcdGFkZFJlc291cmNlRmxhZzogZnVuY3Rpb24oaWQsIGZsYWcpe1xuXHRcdFx0cmV0dXJuICRodHRwLnBvc3QoYmFzZVVybCArICdyZXNvdXJjZS8nKyBpZCwgZmxhZylcblx0XHRcdC50aGVuKCByZXMgPT4gcmVzLmRhdGEpXG5cdFx0XHQuY2F0Y2goZXJyID0+IGVyci5kYXRhKTtcblx0XHR9LFxuXHRcdGRlbGV0ZVJlc291cmNlRmxhZzogZnVuY3Rpb24oZmxhZ0lkLCByZXNvdXJjZUlkKXtcblx0XHRcdHJldHVybiAkaHR0cC5kZWxldGUoYmFzZVVybCArICdyZXNvdXJjZS8nKyBmbGFnSWQpXG5cdFx0XHQudGhlbiggKCkgPT4gb2JqLmZldGNoUmVzb3VyY2VGbGFncyhyZXNvdXJjZUlkKSk7XG5cdFx0fVxuXG5cdH1cblx0cmV0dXJuIG9iajtcblxufSk7XG4iLCJhcHAuZmFjdG9yeSgnUGxhbkZhY3RvcnknLCBmdW5jdGlvbigkaHR0cCkge1xuXG4gIHZhciBiYXNlVXJsID0gJy9hcGkvcGxhbnMvJztcblxuICByZXR1cm4ge1xuXG4gICAgYWRkTmV3UGxhbjogZnVuY3Rpb24obmFtZSwgZGVzY3JpcHRpb24sIHRvcGljSWQpe1xuICAgICAgcmV0dXJuICRodHRwLnBvc3QoYmFzZVVybCwge25hbWU6bmFtZSwgZGVzY3JpcHRpb246ZGVzY3JpcHRpb24sIHRvcGljSWQ6dG9waWNJZH0pXG4gICAgICAudGhlbihyZXMgPT4gcmVzLmRhdGEpO1xuICAgIH0sXG5cbiAgICBmZXRjaFBsYW5zQnlUb3BpYzogZnVuY3Rpb24odG9waWNJZCl7XG4gICAgXHRyZXR1cm4gJGh0dHAuZ2V0KGJhc2VVcmwgKyAndG9waWMvJyArIHRvcGljSWQpXG4gICAgXHQudGhlbihyZXMgPT4gcmVzLmRhdGEpO1xuICAgIH0sXG5cbiAgICBhZGRSZXNvdXJjZVRvUGxhbjogZnVuY3Rpb24ocGxhbklkLCByZXNvdXJjZUlkKXtcbiAgICBcdHJldHVybiAkaHR0cC5wb3N0KGJhc2VVcmwgKyBwbGFuSWQgKyAnL3Jlc291cmNlLycgKyByZXNvdXJjZUlkKVxuICAgIFx0LnRoZW4ocmVzID0+IHJlcy5kYXRhKTtcbiAgICB9LFxuXG4gICAgZmV0Y2hSZXNvdXJjZXNCeVBsYW46IGZ1bmN0aW9uKHBsYW5JZCl7XG4gICAgXHRyZXR1cm4gJGh0dHAuZ2V0KGJhc2VVcmwgKyBwbGFuSWQgKyAnL3Jlc291cmNlcycpXG4gICAgXHQudGhlbihyZXMgPT4gcmVzLmRhdGEpO1xuICAgIH0sXG5cbiAgICBmZXRjaFBsYW5CeUlkOiBmdW5jdGlvbihwbGFuSWQpe1xuICAgIFx0cmV0dXJuICRodHRwLmdldChiYXNlVXJsICsgcGxhbklkKVxuICAgIFx0LnRoZW4ocmVzID0+IHJlcy5kYXRhKTtcbiAgICB9LFxuXG4gICAgZmV0Y2hQbGFuc0J5VXNlcjogZnVuY3Rpb24odXNlcmlkKXtcbiAgICBcdHJldHVybiAkaHR0cC5nZXQoYmFzZVVybCArICd1c2VyLycgKyB1c2VyaWQpXG4gICAgXHQudGhlbihyZXMgPT4gcmVzLmRhdGEpO1xuICAgIH0sXG5cbiAgICByZW1vdmVSZXNvdXJjZUZyb21QbGFuOiBmdW5jdGlvbihwbGFuSWQsIHJlc291cmNlSWQpe1xuICAgICAgcmV0dXJuICRodHRwLmRlbGV0ZShiYXNlVXJsICsgcGxhbklkICsgJy9yZXNvdXJjZS8nICsgcmVzb3VyY2VJZClcbiAgICAgIC50aGVuKHJlcyA9PiByZXMuZGF0YSk7XG4gICAgfSxcblxuICAgIHJlbW92ZVBsYW46IGZ1bmN0aW9uKHBsYW5JZCl7XG4gICAgICByZXR1cm4gJGh0dHAuZGVsZXRlKGJhc2VVcmwgKyBwbGFuSWQpXG4gICAgICAudGhlbihyZXMgPT4gcmVzLmRhdGEpO1xuICAgIH1cblxuICB9XG5cbn0pO1xuIiwiYXBwLmZhY3RvcnkoJ1ByZXJlcUZhY3RvcnknLCBmdW5jdGlvbigkaHR0cCl7XG5cblx0dmFyIGJhc2VVcmwgPSAnL2FwaS9wcmVyZXF1aXNpdGVzLyc7XG5cblx0cmV0dXJuIHtcblxuXHRcdGZldGNoQWxsOiBmdW5jdGlvbigpe1xuXHRcdFx0cmV0dXJuICRodHRwLmdldChiYXNlVXJsKVxuXHRcdFx0LnRoZW4ocmVzID0+IHJlcy5kYXRhKTtcblx0XHR9LFxuXG5cdFx0cmVtb3ZlUmVsYXRpb25zaGlwOiBmdW5jdGlvbih0b3BpY0lkLCByZWxhdGlvbklkKXtcblx0XHRcdHJldHVybiAkaHR0cC5kZWxldGUoYmFzZVVybCArICcvdG9waWMvJyArIHRvcGljSWQgKyAnL3ByZXJlcS8nICsgcmVsYXRpb25JZClcblx0XHRcdC50aGVuKHJlcyA9PiByZXMuZGF0YSk7XG5cdFx0fVxuXG5cdH1cblxufSkiLCJhcHAuZmFjdG9yeSgnUmVzb3VyY2VGYWN0b3J5JywgZnVuY3Rpb24oJGh0dHApe1xuXHR2YXIgYmFzZVVybCA9ICcvYXBpL3Jlc291cmNlcy8nO1xuXHR2YXIgUmVzb3VyY2VGYWN0b3J5ID0ge307XG5cblx0UmVzb3VyY2VGYWN0b3J5LmZldGNoQWxsID0gZnVuY3Rpb24oKXtcblx0XHRyZXR1cm4gJGh0dHAuZ2V0KGJhc2VVcmwpXG5cdFx0LnRoZW4ocmVzID0+IHJlcy5kYXRhKTtcblx0fVxuXG5cdFJlc291cmNlRmFjdG9yeS5mZXRjaEJ5SWQgPSBmdW5jdGlvbihpZCl7XG5cdFx0cmV0dXJuICRodHRwLmdldChiYXNlVXJsK2lkKVxuXHRcdC50aGVuKHJlcyA9PiByZXMuZGF0YSk7XG5cdH1cblxuICBSZXNvdXJjZUZhY3RvcnkuZmV0Y2hCeVVzZXIgPSBmdW5jdGlvbihpZCkge1xuICAgIHJldHVybiAkaHR0cC5nZXQoYmFzZVVybCArICd1c2VyLycgKyBpZClcbiAgICAudGhlbihyZXMgPT4gcmVzLmRhdGEpO1xuICB9XG5cblx0UmVzb3VyY2VGYWN0b3J5LnVwZGF0ZVJlc291cmNlID0gZnVuY3Rpb24ocmVzb3VyY2Upe1xuXHRcdHJldHVybiAkaHR0cC5wdXQoYmFzZVVybCArIHJlc291cmNlLmlkLCByZXNvdXJjZSlcblx0XHQudGhlbihyZXMgPT4gcmVzLmRhdGEpO1xuXHR9XG5cblx0UmVzb3VyY2VGYWN0b3J5LmRlbGV0ZVJlc291cmNlID1mdW5jdGlvbihpZCl7XG5cdFx0cmV0dXJuICRodHRwLmRlbGV0ZShiYXNlVXJsK2lkKVxuXHRcdC50aGVuKCgpID0+IHsgcmV0dXJuIFJlc291cmNlRmFjdG9yeS5mZXRjaEFsbCgpIH0pO1xuXHR9XG5cblx0UmVzb3VyY2VGYWN0b3J5LmFkZFRhZyA9IGZ1bmN0aW9uKHJlc291cmNlSWQsIHRhZykge1xuXHRcdHJldHVybiAkaHR0cC5wb3N0KGJhc2VVcmwgKyByZXNvdXJjZUlkICsgJy90YWcnLCB7IHRhZ05hbWU6IHRhZyB9KTtcblx0fVxuXG5cdFJlc291cmNlRmFjdG9yeS5hZGROZXdSZXNvdXJjZSA9IGZ1bmN0aW9uKG5hbWUsIHVybCwgdHlwZSwgdG9waWNJZCl7XG4gICAgcmV0dXJuICRodHRwLnBvc3QoYmFzZVVybCwge25hbWU6bmFtZSwgdXJsOnVybCwgdHlwZTp0eXBlLCB0b3BpY0lkOiB0b3BpY0lkfSlcbiAgICAudGhlbihyZXMgPT4gcmVzLmRhdGEpO1xuICB9XG5cblx0cmV0dXJuIFJlc291cmNlRmFjdG9yeTtcblxufSk7XG4iLCJhcHAuZmFjdG9yeSgnU2lnbnVwRmFjdG9yeScsIGZ1bmN0aW9uICgkaHR0cCkge1xuICB2YXIgU2lnbnVwRmFjdG9yeSA9IHt9O1xuXG4gIFNpZ251cEZhY3RvcnkuY3JlYXRlVXNlciA9IGZ1bmN0aW9uIChuZXdVc2VyKSB7XG4gICAgcmV0dXJuICRodHRwLnBvc3QoJy9hcGkvdXNlcnMnLCBuZXdVc2VyKVxuICAgIC50aGVuKGZ1bmN0aW9uIChjcmVhdGVkVXNlcikge1xuICAgICAgcmV0dXJuIGNyZWF0ZWRVc2VyLmRhdGE7XG4gICAgfSk7XG4gIH07XG5cbiAgcmV0dXJuIFNpZ251cEZhY3Rvcnk7XG59KVxuIiwiYXBwLmZhY3RvcnkoJ1RvcGljRmFjdG9yeScsIGZ1bmN0aW9uKCRodHRwKSB7XG5cbiAgdmFyIGJhc2VVcmwgPSAnL2FwaS90b3BpY3MvJztcblxuICB2YXIgb2JqPSB7XG5cbiAgICBmZXRjaEFsbDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gJGh0dHAuZ2V0KGJhc2VVcmwpXG4gICAgICAudGhlbihyZXMgPT4gcmVzLmRhdGEpO1xuICAgIH0sXG5cbiAgICBmZXRjaEJ5SWQ6IGZ1bmN0aW9uKGlkKSB7XG4gICAgICByZXR1cm4gJGh0dHAuZ2V0KGJhc2VVcmwgKyBpZClcbiAgICAgIC50aGVuKHJlcyA9PiByZXMuZGF0YSk7XG4gICAgfSxcblxuICAgIGFkZE5ld1RvcGljOiBmdW5jdGlvbih0aXRsZSwgZGVzY3JpcHRpb24pe1xuICAgICAgcmV0dXJuICRodHRwLnBvc3QoYmFzZVVybCwge3RpdGxlOnRpdGxlLCBkZXNjcmlwdGlvbjpkZXNjcmlwdGlvbn0pXG4gICAgICAudGhlbihyZXMgPT4gcmVzLmRhdGEpO1xuICAgIH0sXG5cbiAgICB1cGRhdGVUb3BpYzogZnVuY3Rpb24odG9waWMpe1xuICAgICAgcmV0dXJuICRodHRwLnB1dChiYXNlVXJsICsgdG9waWMuaWQsIHRvcGljKVxuICAgICAgLnRoZW4ocmVzID0+IHJlcy5kYXRhKTtcbiAgICB9LFxuXG4gICAgZGVsZXRlVG9waWM6IGZ1bmN0aW9uKGlkKXtcbiAgICAgIHJldHVybiAkaHR0cC5kZWxldGUoYmFzZVVybCArIGlkKVxuICAgICAgLnRoZW4oICgpPT4gb2JqLmZldGNoQWxsKCkpO1xuXG4gICAgfSxcblxuICAgIHN1Z2dlc3RUb3BpYzogZnVuY3Rpb24odHlwZSwgdG9waWNJZCwgbmV3VG9waWNOYW1lKSB7XG4gICAgICAvLyBjb252ZXJ0IHRvIHJvdXRlIGZvcm1hdFxuICAgICAgaWYodHlwZSA9PT0gJ3ByZXJlcScpIHR5cGUgPSAncHJlcmVxdWlzaXRlJztcbiAgICAgIGVsc2UgaWYodHlwZSA9PT0gJ3N1YnNlcScpIHR5cGUgPSAnc3Vic2VxdWVudCc7XG5cbiAgICAgIHJldHVybiAkaHR0cC5wb3N0KGJhc2VVcmwgKyB0b3BpY0lkICsgJy8nICsgdHlwZSwgeyB0aXRsZTogbmV3VG9waWNOYW1lIH0pO1xuICAgIH0sXG5cbiAgICAvLyBTb3J0cyB2b3RlZCBkYXRhIGFycmF5cyAtIGkuZS4sIHByZXJlcXVpc2l0ZXMsIHN1YnNlcXVlbnQgdG9waWNzLCBhbmQgcmVzb3VyY2VzXG4gICAgLy8gLS0gZGF0YUFyciA9IGRhdGEgYXJyYXkgdG8gYmUgc29ydGVkXG4gICAgLy8gLS0gdm90ZXMgPSAkc2NvcGUubnVtVm90ZXMgb2JqZWN0IHZhbHVlIHRvIHNvcnQgYnlcbiAgICAvLyAtLSBpZEtleSA9IGlkS2V5IG9uIGRhdGFBcnIgY29ycmVzcG9uZGluZyB0byB0aGUga2V5IGluIHZvdGVzXG4gICAgc29ydERhdGE6IGZ1bmN0aW9uKGRhdGFBcnIsIHZvdGVzLCBpZEtleSkge1xuICAgICAgaWYoIXZvdGVzKSByZXR1cm4gZGF0YUFycjsgLy8gaWYgbm8gdm90ZXMgZm91bmQsIGRvIG5vdCBzb3J0XG5cbiAgICAgIGZ1bmN0aW9uIGluT3JkZXIgKGluZGV4KSB7XG4gICAgICAgIGlmIChpbmRleCA9PT0gZGF0YUFyci5sZW5ndGggLSAxKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgdmFyIGJhc2VJZCA9IGRhdGFBcnJbaW5kZXhdW2lkS2V5XSxcbiAgICAgICAgICAgIG5leHRJZCA9IGRhdGFBcnJbaW5kZXggKyAxXVtpZEtleV0sXG4gICAgICAgICAgICBudW1Wb3Rlc0Jhc2UgPSAwLFxuICAgICAgICAgICAgbnVtVm90ZXNOZXh0ID0gMDtcbiAgICAgICAgaWYodm90ZXNbYmFzZUlkXSkgbnVtVm90ZXNCYXNlID0gdm90ZXNbYmFzZUlkXS5sZW5ndGg7XG4gICAgICAgIGlmKHZvdGVzW25leHRJZF0pIG51bVZvdGVzTmV4dCA9IHZvdGVzW25leHRJZF0ubGVuZ3RoO1xuICAgICAgICByZXR1cm4gbnVtVm90ZXNCYXNlID49IG51bVZvdGVzTmV4dDtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gc3dhcCAoaW5kZXgpIHtcbiAgICAgICAgdmFyIG9sZExlZnRWYWx1ZSA9IGRhdGFBcnJbaW5kZXhdO1xuICAgICAgICBkYXRhQXJyW2luZGV4XSA9IGRhdGFBcnJbaW5kZXggKyAxXTtcbiAgICAgICAgZGF0YUFycltpbmRleCArIDFdID0gb2xkTGVmdFZhbHVlO1xuICAgICAgfVxuXG4gICAgICB2YXIgc29ydGVkID0gZmFsc2U7XG4gICAgICBmb3IgKHZhciBlbmQgPSBkYXRhQXJyLmxlbmd0aDsgZW5kID4gMCAmJiAhc29ydGVkOyBlbmQtLSkge1xuICAgICAgICBzb3J0ZWQgPSB0cnVlO1xuICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IGVuZDsgaisrKSB7XG4gICAgICAgICAgaWYgKCFpbk9yZGVyKGopKSB7XG4gICAgICAgICAgICBzd2FwKGopO1xuICAgICAgICAgICAgc29ydGVkID0gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gZGF0YUFycjtcbiAgICB9XG5cbiAgfVxuICByZXR1cm4gb2JqO1xuXG59KTtcbiIsIid1c2Ugc3RyaWN0J1xuXG5hcHAuZmFjdG9yeSgnVXNlcnNGYWN0b3J5JywgZnVuY3Rpb24gKCRodHRwKSB7XG5cblx0dmFyIG9iaiA9IHt9O1xuXG4gIGxldCBiYXNlVXJsID0gJy9hcGkvdXNlcnMvJ1xuXG4gIGxldCBnZXREYXRhID0gcmVzID0+IHJlcy5kYXRhXG5cbiAgb2JqLmdldEFsbFVzZXJzID0gKCkgPT4gJGh0dHAuZ2V0KGJhc2VVcmwpLnRoZW4oZ2V0RGF0YSlcblxuICBvYmouZGVsZXRlVXNlcj0gdXNlciA9PiAkaHR0cC5kZWxldGUoYmFzZVVybCArIHVzZXIuaWQpLnRoZW4oKCkgPT4gb2JqLmdldEFsbFVzZXJzKCkpXG5cbiAgb2JqLnVwZGF0ZVVzZXI9IHVzZXIgPT4gJGh0dHAucHV0KGJhc2VVcmwgKyB1c2VyLmlkLCB1c2VyKVxuXG4gIG9iai5nZXRCeUlkID0gaWQgPT4gJGh0dHAuZ2V0KGJhc2VVcmwgKyBpZCkudGhlbihnZXREYXRhKVxuXG5cdHJldHVybiBvYmo7XG5cbn0pO1xuIiwiYXBwLmZhY3RvcnkoJ1ZvdGVGYWN0b3J5JywgZnVuY3Rpb24oJGh0dHAsICRxKSB7XG5cbiAgY29uc3QgdXB2b3RlUGF0aCA9ICcvYXBpL3Vwdm90ZS8nO1xuXG4gIHZhciBWb3RlRmFjdG9yeSA9IHt9O1xuXG4gICAgLy8gUmV0dXJucyBhcnJheSBvZiBleGlzdGluZyB2b3RlcyBmb3IgYWxsIHJlc291cmNlc1xuICAgIC8vIC0tIFRha2VzIGFuIGFycmF5IG9mIHJlc291cmNlIElEcyB0byBwdWxsIHZvdGVzIGZvclxuICAgIC8vIC0tIElmIG9taXR0ZWQsIHB1bGxzIGFsbCB2b3Rlc1xuICBWb3RlRmFjdG9yeS5mZXRjaFJlc291cmNlVm90ZXMgPSBmdW5jdGlvbihyZXNvdXJjZUlkcykge1xuICAgIHJldHVybiAkaHR0cC5nZXQodXB2b3RlUGF0aCArICdyZXNvdXJjZScsIHsgcGFyYW1zOiB7cmVzb3VyY2VJZHN9IH0pXG4gICAgLnRoZW4ocmVzID0+IHJlcy5kYXRhICk7XG4gIH1cblxuICAvLyBSZXR1cm5zIGFycmF5IG9mIGV4aXN0aW5nIHZvdGVzIGZvciBhbGwgcHJlcmVxdWlzaXRlcyBvZiBhIHRvcGljXG4gIFZvdGVGYWN0b3J5LmZldGNoUHJlcmVxVm90ZXMgPSBmdW5jdGlvbih0b3BpY0lkKSB7XG4gICAgcmV0dXJuICRodHRwLmdldCh1cHZvdGVQYXRoICsgJ3JlbGF0aW9uc2hpcCcsIHsgcGFyYW1zOiB7dG9waWNJZH0gfSlcbiAgICAudGhlbihyZXMgPT4gcmVzLmRhdGEgKTtcbiAgfVxuXG4gIC8vIFJldHVybnMgYXJyYXkgb2YgZXhpc3Rpbmcgdm90ZXMgZm9yIGFsbCBwcmVyZXF1aXNpdGVzIG9mIGEgdG9waWNcbiAgVm90ZUZhY3RvcnkuZmV0Y2hTdWJzZXFWb3RlcyA9IGZ1bmN0aW9uKHRvcGljSWQpIHtcbiAgICByZXR1cm4gJGh0dHAuZ2V0KHVwdm90ZVBhdGggKyAncmVsYXRpb25zaGlwJywgeyBwYXJhbXM6IHsgcHJlcmVxdWlzaXRlSWQ6IHRvcGljSWQgfSB9KVxuICAgIC50aGVuKHJlcyA9PiByZXMuZGF0YSApO1xuICB9XG5cbiAgVm90ZUZhY3RvcnkuZ2V0UHJvY2Vzc2VkVm90ZXMgPSBmdW5jdGlvbih0b3BpYykge1xuICAgIHJldHVybiAkcS5hbGwoW1xuICAgICAgVm90ZUZhY3RvcnkuZmV0Y2hSZXNvdXJjZVZvdGVzKFxuICAgICAgICB0b3BpYy5yZXNvdXJjZXMubWFwKCBmdW5jdGlvbihyZXNvdXJjZSkge1xuICAgICAgICAgIHJldHVybiByZXNvdXJjZS5pZDtcbiAgICAgIH0pKSxcbiAgICAgIFZvdGVGYWN0b3J5LmZldGNoUHJlcmVxVm90ZXModG9waWMuaWQpLFxuICAgICAgVm90ZUZhY3RvcnkuZmV0Y2hTdWJzZXFWb3Rlcyh0b3BpYy5pZClcbiAgICBdKVxuICAgIC50aGVuKCBmdW5jdGlvbihkYlZvdGVzKSB7XG5cbiAgICAgIGZ1bmN0aW9uIHByb2Nlc3NWb3Rlcyh2b3RlcywgaWRLZXkpIHtcbiAgICAgICAgdmFyIHByb2Nlc3NlZFZvdGVzID0ge30sIGtleTtcbiAgICAgICAgdm90ZXMuZm9yRWFjaCggZnVuY3Rpb24odm90ZSkge1xuICAgICAgICAgIGtleSA9IHZvdGVbaWRLZXldO1xuICAgICAgICAgIGlmKCFwcm9jZXNzZWRWb3Rlc1sga2V5IF0pIHByb2Nlc3NlZFZvdGVzWyBrZXkgXSA9IFtdO1xuICAgICAgICAgIHByb2Nlc3NlZFZvdGVzWyBrZXkgXS5wdXNoKHZvdGUudXNlcklkKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBwcm9jZXNzZWRWb3RlcztcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcmVzb3VyY2VzOiBwcm9jZXNzVm90ZXMoZGJWb3Rlc1swXSwgJ3Jlc291cmNlSWQnKSxcbiAgICAgICAgcHJlcmVxOiBwcm9jZXNzVm90ZXMoZGJWb3Rlc1sxXSwgJ3ByZXJlcXVpc2l0ZUlkJyksXG4gICAgICAgIHN1YnNlcTogcHJvY2Vzc1ZvdGVzKGRiVm90ZXNbMl0sICd0b3BpY0lkJylcbiAgICAgIH07XG5cbiAgICB9KTtcbiAgfVxuXG5cbiAgLy8gUmVzb2x2ZXMgdG8gdHJ1ZSBpZiB0aGUgdm90ZSB3YXMgc3VjY2Vzc2Z1bGx5IGFkZGVkXG4gIC8vIC0tIHRvcGljSWQgaXMgb3B0aW9uYWw7IG9ubHkgdXNlZCBmb3IgcmVsYXRpb25zaGlwIHZvdGluZ1xuICBWb3RlRmFjdG9yeS5hZGRWb3RlID0gZnVuY3Rpb24odHlwZSwgaWQsIHRvcGljSWQpIHtcbiAgICB2YXIgaWRPYmogPSB7fSxcbiAgICAgICAgcGF0aCA9IHVwdm90ZVBhdGg7XG4gICAgaWYodHlwZSA9PT0gJ3ByZXJlcScpIHtcbiAgICAgIGlkT2JqID0ge1xuICAgICAgICB0b3BpY0lkOiB0b3BpY0lkLFxuICAgICAgICBwcmVyZXF1aXNpdGVJZDogaWRcbiAgICAgIH1cbiAgICAgIHBhdGggKz0gJ3JlbGF0aW9uc2hpcCc7XG4gICAgfSBlbHNlIGlmKHR5cGUgPT09ICdzdWJzZXEnKSB7XG4gICAgICBpZE9iaiA9IHtcbiAgICAgICAgdG9waWNJZDogaWQsXG4gICAgICAgIHByZXJlcXVpc2l0ZUlkOiB0b3BpY0lkXG4gICAgICB9XG4gICAgICBwYXRoICs9ICdyZWxhdGlvbnNoaXAnO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZE9ialt0eXBlICsgJ0lkJ10gPSBpZDtcbiAgICAgIHBhdGggKz0gdHlwZTtcbiAgICB9XG4gICAgcmV0dXJuICRodHRwLnBvc3QocGF0aCwgaWRPYmopXG4gICAgLnRoZW4oIGZ1bmN0aW9uKHJlcykge1xuICAgICAgaWYocmVzLnN0YXR1cyA9PT0gMjAxKSByZXR1cm4gdHJ1ZTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9KVxuICB9XG5cbiAgLy8gUmVzb2x2ZXMgdG8gdHJ1ZSBpZiB0aGUgdm90ZSB3YXMgc3VjY2Vzc2Z1bGx5IGRlbGV0ZWRcbiAgLy8gLS0gdG9waWNJZCBpcyBvcHRpb25hbDsgb25seSB1c2VkIGZvciByZWxhdGlvbnNoaXAgdm90aW5nXG4gIFZvdGVGYWN0b3J5LnJlbW92ZVZvdGUgPSBmdW5jdGlvbih0eXBlLCBpZCwgdG9waWNJZCkge1xuICAgIHZhciBwYXRoID0gdXB2b3RlUGF0aDtcbiAgICBpZih0eXBlID09PSAncHJlcmVxJykge1xuICAgICAgcGF0aCArPSAncmVsYXRpb25zaGlwL3RvcGljLycgKyB0b3BpY0lkICsgJy9wcmVyZXEvJyArIGlkO1xuICAgIH0gZWxzZSBpZih0eXBlID09PSAnc3Vic2VxJykge1xuICAgICAgLy8gdGhlIHByZXJlcSBvZiBhIHN1YnNlcXVlbnQgdG9waWNzID0gdGhlIGN1cnJlbnQgdG9waWNcbiAgICAgIHBhdGggKz0gJ3JlbGF0aW9uc2hpcC90b3BpYy8nICsgaWQgKyAnL3ByZXJlcS8nICsgdG9waWNJZDtcbiAgICB9IGVsc2Uge1xuICAgICAgcGF0aCArPSB0eXBlICsgJy8nICsgaWQ7XG4gICAgfVxuICAgIHJldHVybiAkaHR0cC5kZWxldGUocGF0aClcbiAgICAudGhlbiggZnVuY3Rpb24ocmVzKSB7XG4gICAgICBpZihyZXMuc3RhdHVzID09PSAyMDQpIHJldHVybiB0cnVlO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0pXG4gIH1cblxuXG4gIHJldHVybiBWb3RlRmFjdG9yeTtcblxufSk7XG4iLCJhcHAuY29udHJvbGxlcignQWRkUGxhbk1vZGFsQ3RybCcsIGZ1bmN0aW9uICgkc2NvcGUsICR1aWJNb2RhbEluc3RhbmNlLCBvcHRpb25zLCBQbGFuRmFjdG9yeSwgdG9waWNzLCByZXNvdXJjZXMsICRxKSB7XG4gIGlmKHRvcGljcykgJHNjb3BlLnRvcGljcyA9IHRvcGljczsgLy8gdXNlZCBmb3IgTXkgTGVhcm5pbmcgUGxhbnMgPT4gYWRkVG9waWNcbiAgaWYocmVzb3VyY2VzKSAkc2NvcGUucmVzb3VyY2VzID0gcmVzb3VyY2VzOyAvLyB1c2VkIGZvciBUb3BpYyA9PiBhZGRQbGFuXG5cbiAgaWYob3B0aW9ucy50b3BpY05hbWUpIHtcbiAgICAkc2NvcGUuZm9ybVRpdGxlID0gJ0FkZCBuZXcgcGxhbiBmb3IgJyArIG9wdGlvbnMudG9waWNOYW1lO1xuICAgIHZhciB0b3BpY0lkID0gb3B0aW9ucy50b3BpY0lkO1xuICAgICRzY29wZS5kZWZhdWx0TmFtZSA9ICdNeSAnICsgb3B0aW9ucy50b3BpY05hbWUgKyAnIGxlYXJuaW5nIHBsYW4nO1xuICAgICRzY29wZS5kZWZhdWx0RGVzY3JpcHRpb24gPSAnSSBhbSBsZWFybmluZyAnICsgb3B0aW9ucy50b3BpY05hbWUgKyAnLic7XG4gIH0gZWxzZSB7XG4gICAgJHNjb3BlLmZvcm1UaXRsZSA9ICdBZGQgbmV3IHBsYW4nO1xuICAgICRzY29wZS5kZWZhdWx0TmFtZSA9ICcnO1xuICAgICRzY29wZS5kZWZhdWx0RGVzY3JpcHRpb24gPSAnJztcbiAgfVxuXG4gICRzY29wZS5hZGRQbGFuID0gZnVuY3Rpb24ocGxhbikge1xuICAgIGlmKCFwbGFuLnRvcGljSWQpIHBsYW4udG9waWNJZCA9IG9wdGlvbnMudG9waWNJZDtcbiAgICB2YXIgbmV3UGxhbjtcblxuICAgIHJldHVybiBQbGFuRmFjdG9yeS5hZGROZXdQbGFuKHBsYW4ubmFtZSwgcGxhbi5kZXNjcmlwdGlvbiwgcGxhbi50b3BpY0lkKVxuICAgIC50aGVuKGZ1bmN0aW9uKG5ld0RiUGxhbikge1xuICAgICAgbmV3UGxhbiA9IG5ld0RiUGxhbjtcbiAgICAgIHZhciByZXNvdXJjZUlkcyA9IFtdO1xuICAgICAgZm9yKHZhciBrZXkgaW4gcGxhbi5yZXNvdXJjZXMpIHtcbiAgICAgICAgaWYocGxhbi5yZXNvdXJjZXNba2V5XSkgcmVzb3VyY2VJZHMucHVzaCgra2V5KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiAkcS5hbGwocmVzb3VyY2VJZHMubWFwKCBmdW5jdGlvbihyZXNvdXJjZUlkKSB7XG4gICAgICAgIHJldHVybiBQbGFuRmFjdG9yeS5hZGRSZXNvdXJjZVRvUGxhbihuZXdEYlBsYW4uaWQsIHJlc291cmNlSWQpO1xuICAgICAgfSkpXG4gICAgICAudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIFBsYW5GYWN0b3J5LmZldGNoUGxhbkJ5SWQobmV3RGJQbGFuLmlkKTtcbiAgICAgIH0pO1xuICAgIH0pXG4gICAgLnRoZW4ocGxhbiA9PiAkdWliTW9kYWxJbnN0YW5jZS5jbG9zZShwbGFuKSk7XG4gIH07XG5cbiAgJHNjb3BlLnN1Ym1pdCA9IGZ1bmN0aW9uICgpIHtcbiAgICAkdWliTW9kYWxJbnN0YW5jZS5jbG9zZSgpO1xuICB9O1xuXG4gICRzY29wZS5jbG9zZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAkdWliTW9kYWxJbnN0YW5jZS5kaXNtaXNzKCdjYW5jZWwnKTtcbiAgfTtcblxufSk7XG4iLCJhcHAuY29udHJvbGxlcignQWRkUmVzb3VyY2VNb2RhbEN0cmwnLCBmdW5jdGlvbiAoJHNjb3BlLCAkdWliTW9kYWxJbnN0YW5jZSwgb3B0aW9ucywgUmVzb3VyY2VGYWN0b3J5KSB7XG4gICRzY29wZS5mb3JtVGl0bGUgPSAnQWRkIHJlc291cmNlIHRvICcgKyBvcHRpb25zLnRvcGljTmFtZTtcbiAgdmFyIHRvcGljSWQgPSBvcHRpb25zLnRvcGljSWQ7XG5cbiAgJHNjb3BlLmFkZFJlc291cmNlID0gZnVuY3Rpb24ocmVzb3VyY2UpIHtcbiAgICByZXR1cm4gUmVzb3VyY2VGYWN0b3J5LmFkZE5ld1Jlc291cmNlKHJlc291cmNlLm5hbWUsIHJlc291cmNlLnVybCwgcmVzb3VyY2UudHlwZSwgdG9waWNJZClcbiAgICAudGhlbihmdW5jdGlvbihuZXdSZXNvdXJjZSkge1xuICAgICAgJHVpYk1vZGFsSW5zdGFuY2UuY2xvc2UobmV3UmVzb3VyY2UpO1xuICAgIH0pO1xuICB9O1xuXG4gICRzY29wZS5zdWJtaXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgJHVpYk1vZGFsSW5zdGFuY2UuY2xvc2UoKTtcbiAgfTtcblxuICAkc2NvcGUuY2xvc2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgJHVpYk1vZGFsSW5zdGFuY2UuZGlzbWlzcygnY2FuY2VsJyk7XG4gIH07XG5cbn0pO1xuIiwiYXBwLmNvbnRyb2xsZXIoJ0FkZFJlc291cmNlVG9QbGFuTW9kYWxDdHJsJywgZnVuY3Rpb24gKCRzY29wZSwgJHVpYk1vZGFsLCAkdWliTW9kYWxJbnN0YW5jZSwgcGxhbnMsIHJlc291cmNlLCBvcHRpb25zLCBSZXNvdXJjZUZhY3RvcnksIFBsYW5GYWN0b3J5LCB0b3BpY0lkKSB7XG4gICRzY29wZS5mb3JtVGl0bGUgPSAnQWRkIFxcJycgKyByZXNvdXJjZS5uYW1lICsgJ1xcJyB0byBteSBsZWFybmluZyBwbGFuJztcbiAgJHNjb3BlLnBsYW5zID0gcGxhbnMuY29uY2F0KFt7IG5hbWU6ICctIGNyZWF0ZSBhIG5ldyBwbGFuIC0nLCBpZDogMCB9XSk7IC8vIGFkZHMgYSBkdW1teSBwbGFuIHRvIGFjY29tb2RhdGUgY3JlYXRpb24gb2YgYSBuZXcgb25lXG4gICRzY29wZS5yZXNvdXJjZSA9IHJlc291cmNlO1xuXG5cbiAgLy8gbmV3UGxhbk5hbWUgc2hvdWxkIG9ubHkgZXhpc3QgaWYgJ2NyZWF0ZSBhIG5ldyBwbGFuJyB3YXMgc2VsZWN0ZWQgZm9yIHNlbGVjdGVkUGxhblxuICAkc2NvcGUuYWRkUmVzb3VyY2VUb1BsYW4gPSBmdW5jdGlvbihzZWxlY3RlZFBsYW4pIHtcbiAgICBpZihzZWxlY3RlZFBsYW4ubmV3KSB7XG4gICAgICB2YXIgZGVzY3JpcHRpb24gPSAnTXkgbmV3IGxlYXJuaW5nIHBsYW4uJztcbiAgICAgIHJldHVybiBQbGFuRmFjdG9yeS5hZGROZXdQbGFuKHNlbGVjdGVkUGxhbi5uZXcsIGRlc2NyaXB0aW9uLCB0b3BpY0lkKVxuICAgICAgLnRoZW4oIGZ1bmN0aW9uKG5ld1BsYW4pIHtcbiAgICAgICAgcmV0dXJuIFBsYW5GYWN0b3J5LmFkZFJlc291cmNlVG9QbGFuKG5ld1BsYW4uaWQsICRzY29wZS5yZXNvdXJjZS5pZCk7XG4gICAgICB9KVxuICAgICAgLnRoZW4oZnVuY3Rpb24obmV3UmVzb3VyY2UpIHtcbiAgICAgICAgJHVpYk1vZGFsSW5zdGFuY2UuY2xvc2UobmV3UmVzb3VyY2UpO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBQbGFuRmFjdG9yeS5hZGRSZXNvdXJjZVRvUGxhbihzZWxlY3RlZFBsYW4uZXhpc3RpbmcuaWQsICRzY29wZS5yZXNvdXJjZS5pZClcbiAgICAgIC50aGVuKGZ1bmN0aW9uKG5ld1Jlc291cmNlKSB7XG4gICAgICAgICR1aWJNb2RhbEluc3RhbmNlLmNsb3NlKG5ld1Jlc291cmNlKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfTtcblxuICAkc2NvcGUuc3VibWl0ID0gZnVuY3Rpb24gKCkge1xuICAgICR1aWJNb2RhbEluc3RhbmNlLmNsb3NlKCk7XG4gIH07XG5cbiAgJHNjb3BlLmNsb3NlID0gZnVuY3Rpb24gKCkge1xuICAgICR1aWJNb2RhbEluc3RhbmNlLmRpc21pc3MoJ2NhbmNlbCcpO1xuICB9O1xuXG59KTtcbiIsImFwcC5jb250cm9sbGVyKCdBZGRUb3BpY01vZGFsQ3RybCcsIGZ1bmN0aW9uICgkc2NvcGUsICR1aWJNb2RhbEluc3RhbmNlLCBUb3BpY0ZhY3RvcnkpIHtcbiAgJHNjb3BlLmZvcm1UaXRsZSA9ICdBZGQgbmV3IHRvcGljJztcblxuICAkc2NvcGUuYWRkVG9waWMgPSBmdW5jdGlvbih0b3BpYykge1xuICAgIHJldHVybiBUb3BpY0ZhY3RvcnkuYWRkTmV3VG9waWModG9waWMubmFtZSwgdG9waWMuZGVzY3JpcHRpb24pXG4gICAgLnRoZW4oZnVuY3Rpb24obmV3VG9waWMpIHtcbiAgICAgICR1aWJNb2RhbEluc3RhbmNlLmNsb3NlKG5ld1RvcGljKTtcbiAgICB9KTtcbiAgfTtcblxuICAkc2NvcGUuc3VibWl0ID0gZnVuY3Rpb24gKCkge1xuICAgICR1aWJNb2RhbEluc3RhbmNlLmNsb3NlKCk7XG4gIH07XG5cbiAgJHNjb3BlLmNsb3NlID0gZnVuY3Rpb24gKCkge1xuICAgICR1aWJNb2RhbEluc3RhbmNlLmRpc21pc3MoJ2NhbmNlbCcpO1xuICB9O1xuXG59KTtcbiIsIi8vIGZvciB1c2VycyB0byBmbGFnIGEgbW9kYWxcbmFwcC5jb250cm9sbGVyKCdBZGRGbGFnTW9kYWxJbnN0YW5jZUN0cmwnLCBmdW5jdGlvbigkc2NvcGUsICR3aW5kb3csIG9wdGlvbnMsICR1aWJNb2RhbEluc3RhbmNlLCBGbGFnRmFjdG9yeSl7XG4gICRzY29wZS5yZWFzb25zPSBbJ1J1ZGUgb3IgQWJ1c2l2ZScsICdTcGFtJywgJ0R1cGxpY2F0ZSddO1xuXG4gIGlmKG9wdGlvbnMudHlwZSA9PT0gJ3Jlc291cmNlJyl7XG4gICAgJHNjb3BlLnJlYXNvbnMucHVzaCgnT2ZmLVRvcGljJyk7XG4gICAgJHNjb3BlLmFkZEZsYWcgPSBcImFkZFJlc291cmNlRmxhZ1wiO1xuICAgICRzY29wZS5oZWFkaW5nID0gJ1Jlc291cmNlJztcbiAgfVxuICBlbHNlIHtcbiAgICAkc2NvcGUuYWRkRmxhZyA9IFwiYWRkVG9waWNGbGFnXCI7XG4gICAgJHNjb3BlLmhlYWRpbmcgPSAnVG9waWMnO1xuICB9XG4gICRzY29wZS5pZCA9IG9wdGlvbnMuaWQ7XG5cbiAgJHNjb3BlLmZsYWdJdD0gZnVuY3Rpb24oZmxhZyl7XG5cbiAgICBGbGFnRmFjdG9yeVskc2NvcGUuYWRkRmxhZ10oJHNjb3BlLmlkLCBmbGFnKVxuICAgIC50aGVuKGZ1bmN0aW9uKHJlcyl7XG4gICAgICBpZihyZXNbMF09PT0gXCJZXCIpICR3aW5kb3cuYWxlcnQocmVzKTtcbiAgICAgICR1aWJNb2RhbEluc3RhbmNlLmNsb3NlKCk7XG4gICAgfSlcbiAgfVxuXG5cbiAgJHNjb3BlLmNhbmNlbCA9IGZ1bmN0aW9uICgpIHtcbiAgICAkdWliTW9kYWxJbnN0YW5jZS5kaXNtaXNzKCdjYW5jZWwnKTtcbiAgfTtcbn0pO1xuXG5cbi8vIGZvciBhZG1pbnMgdG8gdmlldyBzdWJtaXR0ZWQgZmxhZ3MgZm9yIGFuIGFzc29jaWF0ZWQgcmVzb3VyY2UvdG9waWNcbmFwcC5jb250cm9sbGVyKCdNb2RhbEluc3RhbmNlQ3RybCcsIGZ1bmN0aW9uICgkc2NvcGUsICR1aWJNb2RhbEluc3RhbmNlLCBGbGFnRmFjdG9yeSkge1xuXG4gICRzY29wZS5oZWFkaW5nPSAkc2NvcGUuZmxhZ1R5cGUgPyAnUmVzb3VyY2UgRmxhZ3MnIDogJ1RvcGljIEZsYWdzJztcblxuICAkc2NvcGUub2sgPSBmdW5jdGlvbiAoKSB7XG4gICAgJHVpYk1vZGFsSW5zdGFuY2UuY2xvc2UoKTtcbiAgfTtcblxuICAkc2NvcGUuY2xvc2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgJHVpYk1vZGFsSW5zdGFuY2UuZGlzbWlzcygnY2FuY2VsJyk7XG4gIH07XG5cbiAgJHNjb3BlLmRlbGV0ZT0gZnVuY3Rpb24oZmxhZyl7XG4gICAgdmFyIGRlbGV0ZUZsYWc9ICRzY29wZS5mbGFnVHlwZSA/IEZsYWdGYWN0b3J5LmRlbGV0ZVJlc291cmNlRmxhZyA6IEZsYWdGYWN0b3J5LmRlbGV0ZVRvcGljRmxhZztcbiAgICB2YXIgbW9kZWxJZD0gJHNjb3BlLmZsYWdUeXBlID8gJ3Jlc291cmNlSWQnIDogJ3RvcGljSWQnO1xuICAgIGRlbGV0ZUZsYWcoZmxhZy5pZCwgZmxhZ1ttb2RlbElkXSlcbiAgICAudGhlbihmdW5jdGlvbihmbGFncyl7XG4gICAgICAkc2NvcGUuZmxhZ3M9IGZsYWdzO1xuICAgIH0pO1xuICB9O1xuXG59KTtcbiIsImFwcC5jb250cm9sbGVyKCdTdWdnZXN0VG9waWNNb2RhbEN0cmwnLCBmdW5jdGlvbiAoJHNjb3BlLCAkdWliTW9kYWxJbnN0YW5jZSwgb3B0aW9ucywgdG9waWNzLCBUb3BpY0ZhY3RvcnkpIHtcblxuICAkc2NvcGUudG9waWNzID0gdG9waWNzO1xuICAkc2NvcGUuZm9ybVRpdGxlID0gb3B0aW9ucy5mb3JtVGl0bGU7XG4gICRzY29wZS5zdWdnZXN0aW9uVHlwZSA9IG9wdGlvbnMuc3VnZ2VzdGlvblR5cGU7XG4gIHZhciB0b3BpY0lkID0gb3B0aW9ucy50b3BpY0lkO1xuXG4gIC8vIHR5cGUgPSB0eXBlIG9mIHRvcGljIHJlbGF0aW9uc2hpcCAocHJlcmVxIG9yIHN1YnNlcSlcbiAgJHNjb3BlLnN1Z2dlc3RUb3BpYyA9IGZ1bmN0aW9uKHR5cGUsIG5ld1RvcGljTmFtZSkge1xuICAgIHJldHVybiBUb3BpY0ZhY3Rvcnkuc3VnZ2VzdFRvcGljKHR5cGUsIHRvcGljSWQsIG5ld1RvcGljTmFtZSlcbiAgICAudGhlbihmdW5jdGlvbihyZXMpIHtcbiAgICAgIC8vIHJldHVybnMgdG8gVG9waWNDdHJsIHdpdGggXCJmYWtlXCIgb2JqZWN0IHJlcHJlc2VudGluZyB0aGUgc3VnZ2VzdGVkIHRvcGljIG9iamVjdFxuICAgICAgdmFyIHJldHVybk9iaiA9IHsgdGl0bGU6IG5ld1RvcGljTmFtZSB9O1xuICAgICAgaWYodHlwZSA9PT0gJ3ByZXJlcScpIHtcbiAgICAgICAgcmV0dXJuT2JqLnByZXJlcXVpc2l0ZUlkID0gcmVzLmRhdGFbMF1bMF0ucHJlcmVxdWlzaXRlSWQ7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdzdWJzZXEnKSB7XG4gICAgICAgIC8vIHN1YnNlcXVlbnQgdG9waWNzIGFyZSBzdG9yZWQgb24gYSB0b3BpY3MgcGFnZSB3aGVyZTpcbiAgICAgICAgLy8gLS0gY3VycmVudCB0b3BpYyA9IHByZXJlcVRvcGljXG4gICAgICAgIC8vIC0tIHByZXJlcVRvcGljID0gY3VycmVudCB0b3BpYydzIHN1YnNlcXVlbnQgdG9waWNcbiAgICAgICAgcmV0dXJuT2JqLnRvcGljSWQgPSByZXMuZGF0YVswXVswXS50b3BpY0lkO1xuICAgICAgfVxuICAgICAgJHVpYk1vZGFsSW5zdGFuY2UuY2xvc2UoW3R5cGUsIHJldHVybk9ial0pO1xuICAgIH0pO1xuICB9XG5cbiAgJHNjb3BlLnN1Ym1pdCA9IGZ1bmN0aW9uICgpIHtcbiAgICAkdWliTW9kYWxJbnN0YW5jZS5jbG9zZSgpO1xuICB9O1xuXG4gICRzY29wZS5jbG9zZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAkdWliTW9kYWxJbnN0YW5jZS5kaXNtaXNzKCdjYW5jZWwnKTtcbiAgfTtcblxufSk7XG4iLCJhcHAuZGlyZWN0aXZlKCdjYXBzdG9uZUxvZ28nLCBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdHJpY3Q6ICdFJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9jb21tb24vZGlyZWN0aXZlcy9jYXBzdG9uZS1sb2dvL2NhcHN0b25lLWxvZ28uaHRtbCdcbiAgICB9O1xufSk7XG4iLCJhcHAuZGlyZWN0aXZlKCdsYW5kaW5nJywgZnVuY3Rpb24oKXtcblxuXHRyZXR1cm57XG5cdFx0cmVzdHJpY3Q6ICdFJyxcblx0XHR0ZW1wbGF0ZVVybDogJ2pzL2NvbW1vbi9kaXJlY3RpdmVzL2xhbmRpbmcvbGFuZGluZy5odG1sJyxcblx0XHRzY29wZTp7XG5cdFx0XHR0b3BpY3M6IFwiPVwiLFxuXHRcdFx0cHJlcmVxczogXCI9XCJcblx0XHR9LFxuXHRcdGNvbnRyb2xsZXI6IGZ1bmN0aW9uKCRzY29wZSwgJHN0YXRlLCBUb3BpY0ZhY3Rvcnkpe1xuXG5cdFx0XHR2YXIgd2lkdGggPSB3aW5kb3cuaW5uZXJXaWR0aCxcblx0XHRcdCAgICBoZWlnaHQgPSB3aW5kb3cuaW5uZXJIZWlnaHQ7XG5cblx0XHRcdC8vSW5pdGlhbGl6ZSB0aGUgY29sb3Igc2NhbGVcblxuXHRcdFx0dmFyIGNvbG9yID0gZDMuc2NhbGUuY2F0ZWdvcnkyMCgpO1xuXG5cblx0XHRcdC8vSW5pdGlhbGl6ZSB0aGUgbm9kZSBzaXplIHNjYWxlXG5cdFx0XHQvL0hlcmUgd2UgYXJlIG1hcHBpbmcgYWxsIHJlc291cmNlIGxlbmd0aHMgdG8gbm9kZSBzaXplczpcblxuXHRcdFx0dmFyIG5vZGVTaXplPSBkMy5zY2FsZS5saW5lYXIoKTtcblxuXHRcdFx0bm9kZVNpemUuZG9tYWluKGQzLmV4dGVudCgkc2NvcGUudG9waWNzLCBmdW5jdGlvbihkKXsgcmV0dXJuIGQucmVzb3VyY2VzLmxlbmd0aH0pKTtcblx0XHRcdG5vZGVTaXplLnJhbmdlKFsxNSw1MF0pO1xuXG5cblx0XHRcdC8vSW5pdGlhbGl6ZSB0aGUgc3ZnIGVsZW1lbnQsIHdoaWNoIHdpbGwgYWN0IGFzIGEgY29udGFpbmVyIGZvciBvdXIgZGF0YSB2aXN1YWxpemF0aW9uXG5cdFx0XHQvLy5jYWxsKGQzLmJlaGF2aW9yLnpvb20oKSktIGNhbGxpbmcgZDMncyB6b29taW5nIGZ1bmN0aW9uYWxpdHlcblx0XHRcdC8vLm9uKCd6b29tJyktIHJlZHJhd2luZyBvdXIgZ3JhcGggd2hlbiB0aGUgem9vbSBldmVudHMgaGFwcGVuXG5cdFx0XHQvLy5hcHBlbmQoKS0gYXBwZW5kaW5nIGEgKGdyb3VwKSBlbGVtZW50LCBub3Qgc3VyZSB3aHkgdGhpcyBpcyBuZWVkZWQ/XG5cblx0XHRcdHZhciBzdmcgPSBkMy5zZWxlY3QoXCIjaG9tZVwiKVxuXHRcdFx0XHRcdFx0LmFwcGVuZChcImRpdlwiKVxuXHRcdFx0XHRcdFx0Ly8gLmNsYXNzZWQoXCJzdmctY29udGFpbmVyXCIsIHRydWUpXG5cdFx0XHRcdFx0ICAgIC5hcHBlbmQoXCJzdmdcIilcblx0XHRcdFx0XHQgICAgLy9yZXNwb25zaXZlIFNWRyBuZWVkcyB0aGVzZSAyIGF0dHJpYnV0ZXMgYW5kIG5vIHdpZHRoIGFuZCBoZWlnaHQgYXR0clxuXHRcdFx0XHRcdCAgICAvLyAuYXR0cihcInByZXNlcnZlQXNwZWN0UmF0aW9cIiwgXCJ4TWluWU1pbiBtZWV0XCIpXG5cdFx0XHRcdFx0ICAgIC8vIC5hdHRyKFwidmlld0JveFwiLCBcIjAgMCAyMDAwIDE3MDBcIilcblx0XHRcdFx0XHQgICAgLy9jbGFzcyB0byBtYWtlIGl0IHJlc3BvbnNpdmVcblx0XHRcdFx0XHQgICAgLy8gLmNsYXNzZWQoXCJzdmctY29udGVudC1yZXNwb25zaXZlXCIsIHRydWUpXG5cdFx0XHRcdFx0ICAgIC5hdHRyKFwid2lkdGhcIiwgd2lkdGgpXG5cdFx0XHRcdFx0ICAgIC5hdHRyKFwiaGVpZ2h0XCIsIGhlaWdodClcblx0XHRcdFx0XHQgICAgLy9aT09NIERJU0FCTEVEXG5cdFx0ICAgIFx0XHQgICAgLmNhbGwoZDMuYmVoYXZpb3Iuem9vbSgpXG5cdFx0ICAgIFx0XHQgICAgLm9uKFwiem9vbVwiLCByZWRyYXcpKVxuXHRcdCAgICBcdFx0ICAgIC5hcHBlbmQoJ2cnKTtcblxuXG4gICAgICAgICAgICBmdW5jdGlvbiByZWRyYXcoKSB7XG4gICAgICAgICAgICAgIHN2Zy5hdHRyKFwidHJhbnNmb3JtXCIsIFwidHJhbnNsYXRlKFwiICsgZDMuZXZlbnQudHJhbnNsYXRlICsgXCIpXCIgKyBcIiBzY2FsZShcIiArIGQzLmV2ZW50LnNjYWxlICsgXCIpXCIpO1xuICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgIC8vLS0tLS0tLS0tLS0tLS0tLUZvcmNlIExheW91dCBDb25maWd1cmF0aW9uLS0tLS0tLS0tLS0tLS0tLS0vL1xuXG5cdFx0XHQvL0luaXRpYWxpemUgZDMncyBmb3JjZSBsYXlvdXRcblx0XHRcdC8vLmNoYXJnZSgpLSBuZWdhdGl2ZSB2YWx1ZXMgaW5kaWNhdGUgcmVwdWxzaW9uLCArIHZhbHVlcyBpbmRpY2F0ZSBhdHRyYWN0aW9uXG5cdFx0XHQvLy5saW5rRGlzdGFuY2UoKS0gdGhlIGRpc3RhbmNlIHdlIGRlc2lyZSBiZXR3ZWVuIGNvbm5lY3RlZCBub2Rlcy5cblx0XHRcdC8vLnNpemUoKS0gc2l6ZSBvZiB0aGUgZ3JhcGgsIG5lZWQgdG8gbWFrZSBpdCByZXNwb25zaXZlXG5cblx0XHRcdHZhciBmb3JjZSA9IGQzLmxheW91dFxuXHRcdFx0XHRcdFx0ICAuZm9yY2UoKVxuXHRcdFx0XHRcdFx0ICAuY2hhcmdlKC02MDApXG5cdFx0XHRcdFx0XHQgIC5saW5rRGlzdGFuY2UoMjAwKVxuXHRcdFx0XHRcdFx0ICAuc2l6ZShbd2lkdGgsIGhlaWdodF0pO1xuXG5cbiAgICAgICAgICAgIC8vIFByZXZlbnQgcGFuIGZ1bmN0aW9uYWxpdHkgZnJvbSBvdmVycmlkaW5nIG5vZGUgZHJhZyBmdW5jdGlvbmFsaXR5XG5cbiAgICAgICAgICAgIHZhciBkcmFnID0gZm9yY2Uuc3RvcCgpXG5cdFx0XHRcdCAgICAgICAgICAgIC5kcmFnKClcblx0XHRcdFx0ICAgICAgICAgICAgLm9uKFwiZHJhZ3N0YXJ0XCIsIGZ1bmN0aW9uKGQpIHsgZDMuZXZlbnQuc291cmNlRXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICB9KTtcblxuXG5cbiAgICAgICAgICAgIC8vRGF0YSBzZXQgdXAgZm9yIGZvcmNlIGdyYXBoIGxpbmtzL25vZGVzXG5cdFx0XHR2YXIgZGF0YSA9IHt9OyAvL3VzZWQgdG8gcmVmZXJlbmNlIHRoZSB0b3BpY3Ncblx0XHRcdHZhciBkYXRhTGlua3MgPSBbXTsgLy90byBzdG9yZSBsaW5rcyhcInJlbGF0aW9uc2hpcHNcIilcblxuXHRcdCAgICAvL2NyZWF0aW5nIGtleSB2YWx1ZSBwYWlycyB3aGVyZSB0aGUga2V5IGlzIHRvcGljIGlkLCB2YWx1ZSBpcyB0aGUgd2hvbGUgdG9waWMgb2JqZWN0XG5cdFx0ICAgICRzY29wZS50b3BpY3MuZm9yRWFjaChmdW5jdGlvbihlbGVtKXtcblx0XHQgIFx0XHRkYXRhW2VsZW0uaWRdID0gZWxlbTtcblx0XHQgICAgfSlcblxuXHRcdCAgICAvL2NyZWF0aW5nIHRoZSBhcnJheSBvZiBsaW5rcyBieSBwdXNoaW5nIG9iamVjdHMgd2l0aCBhIHNvdXJjZSwgdGFyZ2V0IGFuZCB2YWx1ZSh3ZWlnaHQgb2YgbGluZXMpXG5cdFx0ICAgICRzY29wZS5wcmVyZXFzLmZvckVhY2goZnVuY3Rpb24oZWxlbSl7XG5cdFx0ICBcdFx0ZGF0YUxpbmtzLnB1c2goe3NvdXJjZTogZGF0YVtlbGVtLnRvcGljSWRdLCB0YXJnZXQ6IGRhdGFbZWxlbS5wcmVyZXF1aXNpdGVJZF0sIHZhbHVlOjF9KTtcblx0XHQgICAgfSlcblxuXG5cdFx0ICAgIC8vU2V0dGluZyB1cCB0b3BpY3MgYXMgdGhlIGZvcmNlIGdyYXBoIG5vZGVzLCBhbmQgZGF0YUxpbmtzIGFzIHRoZSBsaW5rc1xuXHRcdFx0IGZvcmNlXG5cdFx0XHQgLm5vZGVzKCRzY29wZS50b3BpY3MpXG5cdFx0XHQgLmxpbmtzKGRhdGFMaW5rcylcblx0XHRcdCAuc3RhcnQoKTtcblxuXG5cblx0XHRcdCAvLy0tLS0tLS0tLS0tLVNldHRpbmcgdXAgdGhlIGFjdHVhbCB2aXN1YWwgbm9kZSBhbmQgbGluayBlbGVtZW50cy0tLS0tLS8vXG5cblx0XHRcdCAgdmFyIGxpbmsgPSBzdmcuc2VsZWN0QWxsKFwiLmxpbmtcIilcblx0XHRcdFx0XHRcdCAgICAuZGF0YShkYXRhTGlua3MpXG5cdFx0XHRcdFx0XHQgICAgLmVudGVyKCkuYXBwZW5kKFwibGluZVwiKSAvLyBjcmVhdGVzIGxpbmVzXG5cdFx0XHRcdFx0XHQgICAgLmF0dHIoXCJjbGFzc1wiLCBcImxpbmtcIikgLy9naXZlcyBsaW5rcyBjbGFzcyBzbyBpdCBjYW4gYmUgc2VsZWN0ZWRcblx0XHRcdFx0XHRcdCAgICAuc3R5bGUoXCJzdHJva2VcIiwgXCJibGFja1wiKSAvL3N0cm9rZSBjb2xvclxuXHRcdFx0XHRcdFx0ICAgICAgLy90aGlja25lc3Mgb2YgbGlua3MgICAgICAgICAgICAgICAgICAgICAgICAvL3NjYWxlcyBsaW5lLXdpZHRoc1xuXHRcdFx0XHRcdFx0ICAgIC5zdHlsZShcInN0cm9rZS13aWR0aFwiLCBmdW5jdGlvbihkKSB7IHJldHVybiBNYXRoLnNxcnQoZC52YWx1ZSk7IH0pO1xuXG5cblxuXHRcdFx0ICB2YXIgbm9kZSA9IHN2Zy5zZWxlY3RBbGwoXCJnLm5vZGVcIilcblx0XHRcdFx0XHQgICAgICAgIC5kYXRhKCRzY29wZS50b3BpY3MpXG5cdFx0XHRcdFx0ICAgICAgICAuZW50ZXIoKVxuXHRcdFx0XHRcdCAgICAgICAgLmFwcGVuZChcImdcIikgLy9zdmcgZ3JvdXAgZWxlbWVudCB0aGF0IHdpbGwgY29udGFpbiBjaXJjbGUgYW5kIHRleHQgZWxlbWVudHNcblx0XHRcdFx0XHQgICAgICAgIC5hdHRyKFwiY2xhc3NcIiwgXCJub2RlXCIpLy8gZ2l2ZSBpdCBhIGNsYXNzIG9mIG5vZGVcblx0XHRcdFx0XHQgICAgICAgIC5jYWxsKGZvcmNlLmRyYWcpIC8vbGV0cyB5b3UgZHJhZyBub2RlcyBhcm91bmQgc2NyZWVuXG5cdFx0XHRcdFx0ICAgICAgICAub24oJ2RibGNsaWNrJywgZnVuY3Rpb24oZCl7ICRzdGF0ZS5nbygndG9waWMnLCB7dG9waWNJZDogZC5pZH0pfSkgLy9ldmVudCBoYW5kbGVyIGZvciBnb2luZyB0byB0aGF0IHRvcGljIG5vZGUncyBzdGF0ZVxuXHRcdFx0XHRcdCAgICAgICAgLm9uKCdjbGljaycsIGNvbm5lY3RlZE5vZGVzKTsgLy9ldmVudCBoYW5kbGVyIGFkZGVkIGZvciBoaWdobGlnaHRpbmcgY29ubmVjdGVkIG5vZGVzXG5cblxuXHRcdFx0ICBub2RlLmFwcGVuZChcImNpcmNsZVwiKSAvL2FwcGVuZGluZyBhIGNpcmNsZSB0byBlYWNoIGdyb3VwIGVsZW1lbnRcblx0XHRcdFx0ICAuYXR0cihcInJcIiwgZnVuY3Rpb24oZCl7IHJldHVybiBub2RlU2l6ZShkLnJlc291cmNlcy5sZW5ndGgpfSlcblx0XHRcdFx0ICAuYXR0cihcImlkXCIsIGZ1bmN0aW9uKGQpeyByZXR1cm4gZC50aXRsZTsgfSlcblx0XHRcdFx0ICAuc3R5bGUoXCJmaWxsXCIsIGZ1bmN0aW9uKGQpeyByZXR1cm4gY29sb3IoZC50aXRsZSk7IH0pXG5cblxuXHRcdFx0ICAgbm9kZS5hcHBlbmQoXCJ0ZXh0XCIpLy9hcHBlbmRpbmcgdGV4dCB0byBlYWNoIGdyb3VwIGVsZW1lbnRcblx0XHRcdFx0ICAgLmF0dHIoXCJ0ZXh0LWFuY2hvclwiLCBcIm1pZGRsZVwiKVxuXHRcdFx0XHQgICAuYXR0cihcInhcIiwgZnVuY3Rpb24oZCl7IHJldHVybiBkLnh9KVxuXHRcdFx0XHQgICAuYXR0cihcInlcIiwgZnVuY3Rpb24oZCl7IHJldHVybiBkLnl9KVxuXHRcdFx0XHQgICAudGV4dChmdW5jdGlvbihkKSB7IHJldHVybiBkLnRpdGxlOyB9KTtcblxuXG5cdFx0XHQgIC8vLS0tLS0tLS0tLS0tSGFuZGxlIHRoZSB0aWNrL2ZvcmNlLXNpbXVsYXRpb24gZXZlbnQgYW5kIHVwZGF0ZSBlYWNoIG5vZGVzIGxvY2F0aW9uLS0tLS0tLS0tLy9cblx0XHRcdCAgZm9yY2Uub24oXCJ0aWNrXCIsIGZ1bmN0aW9uKCkge1xuXG5cdFx0XHQgICAgbGlua1xuXHRcdFx0ICAgIC5hdHRyKFwieDFcIiwgZnVuY3Rpb24oZCkgeyByZXR1cm4gZC5zb3VyY2UueDsgfSlcblx0XHRcdCAgICAuYXR0cihcInkxXCIsIGZ1bmN0aW9uKGQpIHsgcmV0dXJuIGQuc291cmNlLnk7IH0pXG5cdFx0XHQgICAgLmF0dHIoXCJ4MlwiLCBmdW5jdGlvbihkKSB7IHJldHVybiBkLnRhcmdldC54OyB9KVxuXHRcdFx0ICAgIC5hdHRyKFwieTJcIiwgZnVuY3Rpb24oZCkgeyByZXR1cm4gZC50YXJnZXQueTsgfSk7XG5cblxuXHRcdFx0ICAgIHZhciBjaXJjbGU9IGQzLnNlbGVjdEFsbChcImNpcmNsZVwiKVxuXHRcdFx0XHRcdFx0ICAgICAgLmF0dHIoXCJjeFwiLCBmdW5jdGlvbihkKSB7IHJldHVybiBkLng7IH0pXG5cdFx0XHRcdFx0XHQgICAgICAuYXR0cihcImN5XCIsIGZ1bmN0aW9uKGQpIHtyZXR1cm4gZC55OyB9KTtcblxuXG5cdFx0ICAgICAgICBkMy5zZWxlY3RBbGwoXCJ0ZXh0XCIpXG5cdFx0ICAgICAgICAgIC5hdHRyKFwieFwiLCBmdW5jdGlvbihkKSB7IHJldHVybiBkLng7IH0pXG5cdFx0ICAgICAgICAgIC5hdHRyKFwieVwiLCBmdW5jdGlvbihkKSB7IHJldHVybiBkLnk7IH0pO1xuXG5cdFx0XHQgIH0pO1xuXG5cblx0XHRcdCAgLy8tLS0tLS0tLS0tLS0tLS0tLUhpZ2hsaWdodGluZyBjb25uZWN0ZWQgbm9kZXMtLS0tLS0tLS0tLS0vL1xuXG5cdFx0XHQgIC8vVG9nZ2xlIHN0b3JlcyB3aGV0aGVyIHRoZSBoaWdobGlnaHRpbmcgaXMgb25cblx0XHRcdCAgdmFyIHRvZ2dsZSA9IDA7XG5cblx0XHRcdCAgLy9DcmVhdGUgYW4gYXJyYXkgbG9nZ2luZyB3aGF0IGlzIGNvbm5lY3RlZCB0byB3aGF0XG5cdFx0XHQgIHZhciBsaW5rZWRCeUluZGV4ID0ge307XG5cdFx0XHQgIGZvciAoIHZhciBpID0gMDsgaSA8ICRzY29wZS50b3BpY3MubGVuZ3RoOyBpKyspIHtcblx0XHRcdCAgICAgIGxpbmtlZEJ5SW5kZXhbaSArIFwiLFwiICsgaV0gPSAxO1xuXHRcdFx0ICB9O1xuXHRcdFx0ICBkYXRhTGlua3MuZm9yRWFjaChmdW5jdGlvbiAoZCkge1xuXHRcdFx0ICAgICAgbGlua2VkQnlJbmRleFtkLnNvdXJjZS5pbmRleCArIFwiLFwiICsgZC50YXJnZXQuaW5kZXhdID0gMTtcblx0XHRcdCAgfSk7XG5cblx0XHRcdCAgLy9UaGlzIGZ1bmN0aW9uIGxvb2tzIHVwIHdoZXRoZXIgYSBwYWlyIGFyZSBuZWlnaGJvdXJzXG5cdFx0XHQgIGZ1bmN0aW9uIG5laWdoYm9yaW5nKGEsIGIpIHtcblx0XHRcdCAgICAgIHJldHVybiBsaW5rZWRCeUluZGV4W2EuaW5kZXggKyBcIixcIiArIGIuaW5kZXhdO1xuXHRcdFx0ICB9XG5cblx0XHRcdCAgZnVuY3Rpb24gY29ubmVjdGVkTm9kZXMoKSB7XG5cblx0XHRcdCAgICAgIGlmICh0b2dnbGUgPT0gMCkge1xuXHRcdFx0ICAgICAgICAgIC8vUmVkdWNlIHRoZSBvcGFjaXR5IG9mIGFsbCBidXQgdGhlIG5laWdoYm91cmluZyBub2Rlc1xuXHRcdFx0ICAgICAgICAgICB2YXIgZCA9IGQzLnNlbGVjdCh0aGlzKS5ub2RlKCkuX19kYXRhX187XG5cdFx0XHQgICAgICAgICAgbm9kZS5zdHlsZShcIm9wYWNpdHlcIiwgZnVuY3Rpb24gKG8pIHtcblx0XHRcdCAgICAgICAgICAgICAgcmV0dXJuIG5laWdoYm9yaW5nKGQsIG8pIHwgbmVpZ2hib3JpbmcobywgZCkgPyAxIDogMC4xO1xuXHRcdFx0ICAgICAgICAgIH0pO1xuXG5cdFx0XHQgICAgICAgICAgbGluay5zdHlsZShcIm9wYWNpdHlcIiwgZnVuY3Rpb24gKG8pIHtcblx0XHRcdCAgICAgICAgICAgICAgcmV0dXJuIGQuaW5kZXg9PW8uc291cmNlLmluZGV4IHwgZC5pbmRleD09by50YXJnZXQuaW5kZXggPyAxIDogMC4xO1xuXHRcdFx0ICAgICAgICAgIH0pO1xuXG5cdFx0XHQgICAgICAgICAgLy9SZWR1Y2UgdGhlIG9wXG5cblx0XHRcdCAgICAgICAgICB0b2dnbGUgPSAxO1xuXHRcdFx0ICAgICAgfSBlbHNlIHtcblx0XHRcdCAgICAgICAgICAvL1B1dCB0aGVtIGJhY2sgdG8gb3BhY2l0eT0xXG5cdFx0XHQgICAgICAgICAgbm9kZS5zdHlsZShcIm9wYWNpdHlcIiwgMSk7XG5cdFx0XHQgICAgICAgICAgbGluay5zdHlsZShcIm9wYWNpdHlcIiwgMSk7XG5cdFx0XHQgICAgICAgICAgdG9nZ2xlID0gMDtcblx0XHRcdCAgICAgIH1cblxuXHRcdFx0ICB9XG5cblxuXG5cblxuXHRcdH1cblx0fVxuXG59KVxuIiwiYXBwLmRpcmVjdGl2ZSgnbmF2YmFyJywgZnVuY3Rpb24gKCRyb290U2NvcGUsIEF1dGhTZXJ2aWNlLCBBVVRIX0VWRU5UUywgJHN0YXRlLCBUb3BpY0ZhY3RvcnkpIHtcblxuICAgIHJldHVybiB7XG4gICAgICAgIHJlc3RyaWN0OiAnRScsXG4gICAgICAgIHNjb3BlOiB7fSxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9jb21tb24vZGlyZWN0aXZlcy9uYXZiYXIvbmF2YmFyLmh0bWwnLFxuICAgICAgICBsaW5rOiBmdW5jdGlvbiAoc2NvcGUpIHtcblxuICAgICAgICAgICAgc2NvcGUuaXRlbXMgPSBbXG4gICAgICAgICAgICAgICAgeyBsYWJlbDogJ1RvcGljcycsIHN0YXRlOiAndG9waWNzJ30sXG4gICAgICAgICAgICBdO1xuXG4gICAgICAgICAgICBUb3BpY0ZhY3RvcnkuZmV0Y2hBbGwoKS50aGVuKHRvcGljcyA9PiBzY29wZS50b3BpY3MgPSB0b3BpY3MpO1xuXG4gICAgICAgICAgICBzY29wZS5zZWFyY2hGb3JUb3BpYyA9IGZ1bmN0aW9uKHNlYXJjaFRvcGljTmFtZSkge1xuICAgICAgICAgICAgICAkc3RhdGUuZ28oJ3RvcGljcycsIHsgJ2RlZmF1bHRTZWFyY2gnOiBzZWFyY2hUb3BpY05hbWUgfSk7XG4gICAgICAgICAgICAgICQoJyNzZWFyY2gtZHJvcGRvd24nKS5yZW1vdmVDbGFzcygnb3BlbicpOyAvLyBjbG9zZSBzZWFyY2ggYmFyXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNjb3BlLnVzZXIgPSBudWxsO1xuXG4gICAgICAgICAgICBzY29wZS5pc0xvZ2dlZEluID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBBdXRoU2VydmljZS5pc0F1dGhlbnRpY2F0ZWQoKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHNjb3BlLmxvZ291dCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBBdXRoU2VydmljZS5sb2dvdXQoKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAkc3RhdGUuZ28oJ2hvbWUnKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHZhciBzZXRVc2VyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgc2NvcGUudXNlciA9IHVzZXI7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICB2YXIgcmVtb3ZlVXNlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBzY29wZS51c2VyID0gbnVsbDtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHNldFVzZXIoKTtcblxuICAgICAgICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMubG9naW5TdWNjZXNzLCBzZXRVc2VyKTtcbiAgICAgICAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLmxvZ291dFN1Y2Nlc3MsIHJlbW92ZVVzZXIpO1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXQsIHJlbW92ZVVzZXIpO1xuXG5cblxuICAgICAgICAvLyBmdW5jdGlvbiB0b2dnbGVTaWRlQmFyKCkge1xuICAgICAgICAvLyAgICAgdmFyIHBhZ2VXcmFwcGVyID0gJCgnI3BhZ2Utd3JhcHBlcicpO1xuICAgICAgICAvL1xuICAgICAgICAvLyAgICAgaWYgKHBhZ2VXcmFwcGVyLmhhc0NsYXNzKCdzaG93LXNpZGViYXInKSkge1xuICAgICAgICAvLyAgICAgICAgIC8vIERvIHRoaW5ncyBvbiBOYXYgQ2xvc2VcbiAgICAgICAgLy8gICAgICAgICBwYWdlV3JhcHBlci5yZW1vdmVDbGFzcygnc2hvdy1zaWRlYmFyJyk7XG4gICAgICAgIC8vICAgICB9IGVsc2Uge1xuICAgICAgICAvLyAgICAgICAgIC8vIERvIHRoaW5ncyBvbiBOYXYgT3BlblxuICAgICAgICAvLyAgICAgICAgIHBhZ2VXcmFwcGVyLmFkZENsYXNzKCdzaG93LXNpZGViYXInKTtcbiAgICAgICAgLy8gICAgIH1cbiAgICAgICAgLy8gfVxuXG4gICAgICAgIC8vICQoZnVuY3Rpb24oKSB7XG4gICAgICAgIC8vICAgJCgnLnRvZ2dsZS1zaWRlYmFyJykuY2xpY2soZnVuY3Rpb24oKSB7XG4gICAgICAgIC8vICAgICAgIHRvZ2dsZVNpZGVCYXIoKTtcbiAgICAgICAgLy8gICB9KTtcbiAgICAgICAgLy8gfSk7XG5cbiAgICAgIH1cblxuICAgIH07XG5cbn0pO1xuIiwiYXBwLmRpcmVjdGl2ZSgnbXlQbGFuJywgZnVuY3Rpb24gKCRyb290U2NvcGUsIFBsYW5GYWN0b3J5KSB7XG4gIHJldHVybiB7XG4gICAgcmVzdHJpY3Q6ICdFJyxcbiAgICBzY29wZToge1xuICAgICAgcGxhbjogJz0nXG4gICAgfSxcbiAgICB0ZW1wbGF0ZVVybDogJ2pzL2NvbW1vbi9kaXJlY3RpdmVzL3BsYW5zL215LXBsYW4uaHRtbCcsXG4gICAgbGluazogZnVuY3Rpb24gKHNjb3BlLCBlbGVtZW50LCBhdHRyaWJ1dGVzKSB7XG5cbiAgICAgIHZhciB1c2VySWQ7XG4gICAgICBpZigkcm9vdFNjb3BlLnVzZXIpIHVzZXJJZCA9ICRyb290U2NvcGUudXNlci5pZDtcblxuICAgICAgc2NvcGUubW92ZVVwID0gZnVuY3Rpb24ocmVzb3VyY2VJZCkge1xuICAgICAgICB2YXIgaWR4ID0gZ2V0UmVzb3VyY2VJZHgocmVzb3VyY2VJZCk7XG4gICAgICAgIHN3YXBSZXNvdXJjZXMoaWR4LCBpZHgtMSk7XG4gICAgICB9XG5cbiAgICAgIHNjb3BlLm1vdmVEb3duID0gZnVuY3Rpb24ocmVzb3VyY2VJZCkge1xuICAgICAgICB2YXIgaWR4ID0gZ2V0UmVzb3VyY2VJZHgocmVzb3VyY2VJZCk7XG4gICAgICAgIHN3YXBSZXNvdXJjZXMoaWR4LCBpZHgrMSk7XG4gICAgICB9XG5cbiAgICAgIHNjb3BlLnJlbW92ZUZyb21QbGFuID0gZnVuY3Rpb24ocmVzb3VyY2VJZCkge1xuICAgICAgICB2YXIgaWR4ID0gZ2V0UmVzb3VyY2VJZHgocmVzb3VyY2VJZCk7XG4gICAgICAgIFBsYW5GYWN0b3J5LnJlbW92ZVJlc291cmNlRnJvbVBsYW4oc2NvcGUucGxhbi5pZCwgcmVzb3VyY2VJZClcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24oKXtcbiAgICAgICAgICBzY29wZS5wbGFuLnJlc291cmNlcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIHNjb3BlLmRlbGV0ZVBsYW4gPSBmdW5jdGlvbihwbGFuSWQpe1xuICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJ2RlbGV0ZS1wbGFuJywge1xuICAgICAgICAgIHBsYW5JZDogcGxhbklkXG4gICAgICAgIH0pXG4gICAgICAgIHNjb3BlLnBsYW4gPSBudWxsO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBnZXRSZXNvdXJjZUlkeChpZCkge1xuICAgICAgICBmb3IodmFyIGk9MDsgaTxzY29wZS5wbGFuLnJlc291cmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGlmKHNjb3BlLnBsYW4ucmVzb3VyY2VzW2ldLmlkID09PSBpZCkgcmV0dXJuIGk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gc3dhcFJlc291cmNlcyhpZHgxLCBpZHgyKSB7XG4gICAgICAgIHZhciB0ZW1wID0gc2NvcGUucGxhbi5yZXNvdXJjZXNbaWR4MV07XG4gICAgICAgIHNjb3BlLnBsYW4ucmVzb3VyY2VzW2lkeDFdID0gc2NvcGUucGxhbi5yZXNvdXJjZXNbaWR4Ml07XG4gICAgICAgIHNjb3BlLnBsYW4ucmVzb3VyY2VzW2lkeDJdID0gdGVtcDtcbiAgICAgIH1cblxuXG4gICAgfVxuICB9XG59KTtcbiIsIid1c2Ugc3RyaWN0JztcblxuYXBwLmRpcmVjdGl2ZSgnc2VhcmNoQm94JywgZnVuY3Rpb24oVG9waWNGYWN0b3J5KSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdHJpY3Q6ICdBRUMnLFxuICAgICAgICBzY29wZToge1xuICAgICAgICAgICAgaXRlbXM6ICc9JyxcbiAgICAgICAgICAgIHByb21wdDogJ0AnLFxuICAgICAgICAgICAgdGl0bGU6ICdAJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQCcsXG4gICAgICAgICAgICBtb2RlbDogJz0nXG4gICAgICAgIH0sXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnL2pzL2NvbW1vbi9kaXJlY3RpdmVzL3NlYXJjaC1ib3gvc2VhcmNoLWJveC5odG1sJyxcbiAgICAgICAgbGluazogZnVuY3Rpb24oc2NvcGUpIHtcbiAgICAgICAgICAgIFRvcGljRmFjdG9yeS5mZXRjaEFsbCgpLnRoZW4odG9waWNzID0+IHNjb3BlLnRvcGljcyA9IHRvcGljcyk7XG4gICAgICAgIH1cbiAgICB9O1xufSk7XG4iLCJhcHAuZGlyZWN0aXZlKCdyZWxhdGVkVG9waWMnLCBmdW5jdGlvbiAoVm90ZUZhY3RvcnksICRyb290U2NvcGUpIHtcbiAgcmV0dXJuIHtcbiAgICByZXN0cmljdDogJ0UnLFxuICAgIHNjb3BlOiB7XG4gICAgICB0eXBlOiAnPScsXG4gICAgICB0b3BpYzogJz0nLFxuICAgICAgYmFzZVRvcGljSWQ6ICc9JyxcbiAgICAgIHZvdGVzOiAnPScsXG4gICAgfSxcbiAgICB0ZW1wbGF0ZVVybDogJ2pzL2NvbW1vbi9kaXJlY3RpdmVzL3RvcGljcy9yZWxhdGVkLXRvcGljLmh0bWwnLFxuICAgIGxpbms6IGZ1bmN0aW9uIChzY29wZSkge1xuICAgICAgdmFyIHVzZXJJZDtcbiAgICAgIGlmKCRyb290U2NvcGUudXNlcikgdXNlcklkID0gJHJvb3RTY29wZS51c2VyLmlkO1xuXG4gICAgICAvLyB0aGlzIHRvcGljJ3MgSUQgaXMgYWN0dWFsbHkgdGhlICdwcmVyZXF1aXNpdGUnIElEIG9uIHRoZSB0b3BpYyBwYXNzZWQgdG8gdGhlIGRpcmVjdGl2ZVxuICAgICAgLy8gdm90ZSBidXR0b24gc2hvdWxkIGJlIG9uIHRoZSBsZWZ0IGZvciBzdWJzZXF1ZW50OyByaWdodCBmb3IgcHJlcmVxdWlzaXRlIHZvdGluZ1xuICAgICAgaWYoc2NvcGUudHlwZSA9PT0gJ3ByZXJlcScpIHtcbiAgICAgICAgc2NvcGUudG9waWNJZCA9IHNjb3BlLnRvcGljLnByZXJlcXVpc2l0ZUlkO1xuICAgICAgICBzY29wZS5idXR0b25PbkxlZnQgPSBmYWxzZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNjb3BlLnRvcGljSWQgPSBzY29wZS50b3BpYy50b3BpY0lkO1xuICAgICAgICBzY29wZS5idXR0b25PbkxlZnQgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBpc0xvZ2dlZEluID0gdHJ1ZSBpcyB1c2VyIGlzIGxvZ2dlZCBpbjsgaS5lLiwgdGhlcmUgaXMgYSB1c2VyIG9uIHRoZSAkcm9vdFNjb3BlXG4gICAgICBzY29wZS5pc0xvZ2dlZEluID0gdXNlcklkID49IDA7XG5cbiAgICAgIC8vIHZvdGVkID0gdHJ1ZSBpZiB1c2VyIGhhcyB2b3RlZCBvbiB0aGlzIHJlc291cmNlXG4gICAgICBpZihzY29wZS52b3RlcyAmJiBzY29wZS52b3Rlcy5pbmRleE9mKHVzZXJJZCkgPj0gMCkgc2NvcGUudm90ZWQgPSB0cnVlO1xuICAgICAgZWxzZSBzY29wZS52b3RlZCA9IGZhbHNlO1xuXG4gICAgICAvLyBWT1RJTkdcbiAgICAgIHNjb3BlLnVwdm90ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZih1c2VySWQpIHsgLy8gdXNlciBtYXkgdXB2b3RlIG9ubHkgaWYgaGUvc2hlIGlzIGxvZ2dlZCBpblxuICAgICAgICAgIFZvdGVGYWN0b3J5LmFkZFZvdGUoc2NvcGUudHlwZSwgc2NvcGUudG9waWNJZCwgc2NvcGUuYmFzZVRvcGljSWQpXG4gICAgICAgICAgLnRoZW4oIGZ1bmN0aW9uKHN1Y2Nlc3MpIHtcbiAgICAgICAgICAgIGlmKHN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgaWYoIXNjb3BlLnZvdGVzKSBzY29wZS52b3RlcyA9IFtdOyAvLyBpZiB0aGVyZSBhcmUgbm8gZXhpc3Rpbmcgdm90ZXNcbiAgICAgICAgICAgICAgc2NvcGUudm90ZXMucHVzaCh1c2VySWQpO1xuICAgICAgICAgICAgICBzY29wZS52b3RlZCA9IHRydWU7XG4gICAgICAgICAgICAgIGNhbGxGb3JTb3J0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBzY29wZS5kZXZvdGUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYodXNlcklkKSB7IC8vIHVzZXIgbWF5IHVwdm90ZSBvbmx5IGlmIGhlL3NoZSBpcyBsb2dnZWQgaW5cbiAgICAgICAgICBWb3RlRmFjdG9yeS5yZW1vdmVWb3RlKHNjb3BlLnR5cGUsIHNjb3BlLnRvcGljSWQsIHNjb3BlLmJhc2VUb3BpY0lkKVxuICAgICAgICAgIC50aGVuKCBmdW5jdGlvbihzdWNjZXNzKSB7XG4gICAgICAgICAgICBpZihzdWNjZXNzKSB7XG4gICAgICAgICAgICAgIHNjb3BlLnZvdGVzLnNwbGljZShzY29wZS52b3Rlcy5pbmRleE9mKHVzZXJJZCkpO1xuICAgICAgICAgICAgICBzY29wZS52b3RlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICBjYWxsRm9yU29ydCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gY2FsbEZvclNvcnQoKSB7XG4gICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgndm90ZWQtbmVlZC1yZXNvcnQnLCB7XG4gICAgICAgICAgdHlwZTogc2NvcGUudHlwZSxcbiAgICAgICAgICBpZDogc2NvcGUudG9waWNJZCxcbiAgICAgICAgICB2b3Rlczogc2NvcGUudm90ZXNcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICB9XG4gIH1cbn0pO1xuIiwiYXBwLmRpcmVjdGl2ZSgndG9waWNMaXN0aW5nJywgZnVuY3Rpb24gKCRyb290U2NvcGUsIFBsYW5GYWN0b3J5KSB7XG4gIHJldHVybiB7XG4gICAgcmVzdHJpY3Q6ICdFJyxcbiAgICBzY29wZToge1xuICAgICAgdG9waWM6ICc9J1xuICAgIH0sXG4gICAgdGVtcGxhdGVVcmw6ICdqcy9jb21tb24vZGlyZWN0aXZlcy90b3BpY3MvdG9waWMtbGlzdGluZy5odG1sJyxcbiAgICBsaW5rOiBmdW5jdGlvbiAoc2NvcGUpIHtcbiAgICB9XG4gIH1cbn0pO1xuIiwiYXBwLmRpcmVjdGl2ZSgndG9waWNQbGFuJywgZnVuY3Rpb24gKCRyb290U2NvcGUpIHtcbiAgcmV0dXJuIHtcbiAgICByZXN0cmljdDogJ0UnLFxuICAgIHNjb3BlOiB7XG4gICAgICBwbGFuOiAnPScsXG4gICAgICB0b3BpY0lkOiAnPSdcbiAgICB9LFxuICAgIHRlbXBsYXRlVXJsOiAnanMvY29tbW9uL2RpcmVjdGl2ZXMvdG9waWNzL3RvcGljLXBsYW4uaHRtbCcsXG4gICAgbGluazogZnVuY3Rpb24gKHNjb3BlKSB7XG5cbiAgICAgIHZhciB1c2VySWQ7XG4gICAgICBpZigkcm9vdFNjb3BlLnVzZXIpIHVzZXJJZCA9ICRyb290U2NvcGUudXNlci5pZDtcblxuICAgICAgLy9hdmFpbGFibGUgb24gaHRtbFxuICAgICAgc2NvcGUudXNlcklkID0gdXNlcklkO1xuXG4gICAgICAvLyBpc0xvZ2dlZEluID0gdHJ1ZSBpcyB1c2VyIGlzIGxvZ2dlZCBpbjsgaS5lLiwgdGhlcmUgaXMgYSB1c2VyIG9uIHRoZSAkcm9vdFNjb3BlXG4gICAgICBzY29wZS5pc0xvZ2dlZEluID0gdXNlcklkID49IDA7XG5cbiAgICAgIHNjb3BlLmNvcHlQbGFuID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIC8vIHRvIGltcGxlbWVudCA9PiBjb3BpZXMgdGhpcyBwbGFuIHRvIHRoZSB1c2VyJ3MgcGxhblxuICAgICAgfVxuXG4gICAgfVxuICB9XG59KTtcbiIsImFwcC5kaXJlY3RpdmUoJ3RvcGljUmVzb3VyY2UnLCBmdW5jdGlvbiAoQXV0aFNlcnZpY2UsIFRvcGljRmFjdG9yeSwgVm90ZUZhY3RvcnksICRyb290U2NvcGUsICR1aWJNb2RhbCwgUGxhbkZhY3RvcnkpIHtcbiAgcmV0dXJuIHtcbiAgICByZXN0cmljdDogJ0UnLFxuICAgIHNjb3BlOiB7XG4gICAgICByZXNvdXJjZTogJz0nLFxuICAgICAgdG9waWNJZDogJz0nLFxuICAgICAgdm90ZXM6ICc9JyxcbiAgICB9LFxuICAgIHRlbXBsYXRlVXJsOiAnanMvY29tbW9uL2RpcmVjdGl2ZXMvdG9waWNzL3RvcGljLXJlc291cmNlLmh0bWwnLFxuICAgIGxpbms6IGZ1bmN0aW9uIChzY29wZSkge1xuXG4gICAgICB2YXIgdXNlcklkO1xuICAgICAgaWYoJHJvb3RTY29wZS51c2VyKSB1c2VySWQgPSAkcm9vdFNjb3BlLnVzZXIuaWQ7XG5cbiAgICAgIC8vIGlzTG9nZ2VkSW4gPSB0cnVlIGlzIHVzZXIgaXMgbG9nZ2VkIGluOyBpLmUuLCB0aGVyZSBpcyBhIHVzZXIgb24gdGhlICRyb290U2NvcGVcbiAgICAgIHNjb3BlLmlzTG9nZ2VkSW4gPSB1c2VySWQgPj0gMDtcblxuICAgICAgLy8gdm90ZWQgPSB0cnVlIGlmIHVzZXIgaGFzIHZvdGVkIG9uIHRoaXMgcmVzb3VyY2VcbiAgICAgIGlmKHNjb3BlLnZvdGVzICYmIHNjb3BlLnZvdGVzLmluZGV4T2YodXNlcklkKSA+PSAwKSBzY29wZS52b3RlZCA9IHRydWU7XG4gICAgICBlbHNlIHNjb3BlLnZvdGVkID0gZmFsc2U7XG5cbiAgICAgIC8vIFZPVElOR1xuICAgICAgc2NvcGUudXB2b3RlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmKHVzZXJJZCkgeyAvLyB1c2VyIG1heSB1cHZvdGUgb25seSBpZiBoZS9zaGUgaXMgbG9nZ2VkIGluXG4gICAgICAgICAgVm90ZUZhY3RvcnkuYWRkVm90ZSgncmVzb3VyY2UnLCBzY29wZS5yZXNvdXJjZS5pZCwgc2NvcGUudG9waWNJZClcbiAgICAgICAgICAudGhlbiggZnVuY3Rpb24oc3VjY2Vzcykge1xuICAgICAgICAgICAgaWYoc3VjY2Vzcykge1xuICAgICAgICAgICAgICBpZighc2NvcGUudm90ZXMpIHNjb3BlLnZvdGVzID0gW107IC8vIGlmIHRoZXJlIGFyZSBubyBleGlzdGluZyB2b3Rlc1xuICAgICAgICAgICAgICBzY29wZS52b3Rlcy5wdXNoKHVzZXJJZCk7XG4gICAgICAgICAgICAgIHNjb3BlLnZvdGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgY2FsbEZvclNvcnQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHNjb3BlLmRldm90ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZih1c2VySWQpIHsgLy8gdXNlciBtYXkgdXB2b3RlIG9ubHkgaWYgaGUvc2hlIGlzIGxvZ2dlZCBpblxuICAgICAgICAgIFZvdGVGYWN0b3J5LnJlbW92ZVZvdGUoJ3Jlc291cmNlJywgc2NvcGUucmVzb3VyY2UuaWQsIHNjb3BlLnRvcGljSWQpXG4gICAgICAgICAgLnRoZW4oIGZ1bmN0aW9uKHN1Y2Nlc3MpIHtcbiAgICAgICAgICAgIGlmKHN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgc2NvcGUudm90ZXMuc3BsaWNlKHNjb3BlLnZvdGVzLmluZGV4T2YodXNlcklkKSk7XG4gICAgICAgICAgICAgIHNjb3BlLnZvdGVkID0gZmFsc2U7XG4gICAgICAgICAgICAgIGNhbGxGb3JTb3J0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuXG4gICAgICB9XG5cbiAgICAgIC8vIFBMQU5TXG4gICAgICAvLyBhZGQgZXhpc3RpbmcgcmVzb3VyY2UgdG8gcGxhblxuICAgICAgc2NvcGUuYWRkUmVzb3VyY2VUb1BsYW4gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgJHVpYk1vZGFsLm9wZW4oe1xuICAgICAgICAgIGFuaW1hdGlvbjogdHJ1ZSxcbiAgICAgICAgICB0ZW1wbGF0ZVVybDogJy4vanMvY29tbW9uL21vZGFscy92aWV3cy9hZGRSZXNvdXJjZVRvUGxhbi5odG1sJyxcbiAgICAgICAgICBjb250cm9sbGVyOiAnQWRkUmVzb3VyY2VUb1BsYW5Nb2RhbEN0cmwnLFxuICAgICAgICAgIHJlc29sdmU6IHtcbiAgICAgICAgICAgIHRvcGljSWQ6IHNjb3BlLnRvcGljSWQsXG4gICAgICAgICAgICBwbGFuczogUGxhbkZhY3RvcnkuZmV0Y2hQbGFuc0J5VXNlcih1c2VySWQpLFxuICAgICAgICAgICAgcmVzb3VyY2U6IHNjb3BlLnJlc291cmNlLFxuICAgICAgICAgICAgb3B0aW9uczogeyB0b3BpY0lkOiBzY29wZS50b3BpY0lkIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBGTEFHR0lOR1xuICAgICAgc2NvcGUuZmxhZ1Jlc291cmNlID0gZnVuY3Rpb24oaWQpIHtcbiAgICAgICAgJHVpYk1vZGFsLm9wZW4oe1xuICAgICAgICAgIGFuaW1hdGlvbjogdHJ1ZSxcbiAgICAgICAgICB0ZW1wbGF0ZVVybDogJy4vanMvY29tbW9uL21vZGFscy92aWV3cy9hZGRGbGFnTW9kYWwuaHRtbCcsXG4gICAgICAgICAgY29udHJvbGxlcjogJ0FkZEZsYWdNb2RhbEluc3RhbmNlQ3RybCcsXG4gICAgICAgICAgcmVzb2x2ZToge1xuICAgICAgICAgICAgb3B0aW9uczogeyB0eXBlOiAncmVzb3VyY2UnLCBpZDogaWQgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGNhbGxGb3JTb3J0KCkge1xuICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJ3ZvdGVkLW5lZWQtcmVzb3J0Jywge1xuICAgICAgICAgIHR5cGU6ICdyZXNvdXJjZXMnLFxuICAgICAgICAgIGlkOiBzY29wZS5yZXNvdXJjZS5pZCxcbiAgICAgICAgICB2b3Rlczogc2NvcGUudm90ZXNcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICB9XG4gIH1cbn0pO1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9
