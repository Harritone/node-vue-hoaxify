const express = require('express');
const app = express();
const User = require('./user/User');
const bcrypt = require('bcrypt');

app.use(express.json());

app.post('/api/v1/users', (req, res) => {
  bcrypt.hash(req.body.password, 10).then((hash) => {
    const user = { ...req.body, password: hash };
    // const user = Object.assign({}, req.body, { password: hash });
    User.create(user).then(() => {
      return res.send({ message: 'User created' });
    });
  });
});

module.exports = app;
