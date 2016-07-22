app.directive('navbar', function ($rootScope, AuthService, AUTH_EVENTS, $state, TopicFactory) {

    return {
        restrict: 'E',
        scope: {},
        templateUrl: 'js/common/directives/navbar/navbar.html',
        link: function (scope) {

            scope.items = [
                { label: 'Topics', state: 'topics'},
            ];

            TopicFactory.fetchAll().then(topics => scope.topics = topics);

            scope.searchForTopic = function(searchTopicName) {
              $state.go('topics', { 'defaultSearch': searchTopicName });
              $('#search-dropdown').removeClass('open'); // close search bar
            }

            scope.user = null;

            scope.isLoggedIn = function () {
                return AuthService.isAuthenticated();
            };

            scope.logout = function () {
                AuthService.logout().then(function () {
                   $state.go('home');
                });
            };

            var setUser = function () {
                AuthService.getLoggedInUser().then(function (user) {
                    scope.user = user;
                });
            };

            var removeUser = function () {
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
