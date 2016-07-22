'use strict'

app.factory('UsersFactory', function ($http) {

	var obj = {};

  let baseUrl = '/api/users/'

  let getData = res => res.data

  obj.getAllUsers = () => $http.get(baseUrl).then(getData)

  obj.deleteUser= user => $http.delete(baseUrl + user.id).then(() => obj.getAllUsers())

  obj.updateUser= user => $http.put(baseUrl + user.id, user)

  obj.getById = id => $http.get(baseUrl + id).then(getData)

	return obj;

});
