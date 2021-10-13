const jwt = require('jsonwebtoken');

const createToken = (user) => {
  return jwt.sign({ id: user.id }, 'this-is-my-secret');
};

module.exports = {
  createToken,
};
