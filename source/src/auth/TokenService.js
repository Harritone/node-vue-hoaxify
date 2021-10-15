const jwt = require('jsonwebtoken');

const createToken = (user) => {
  return jwt.sign({ id: user.id }, 'this-is-my-secret');
};

const verify = async (token) => {
  return await jwt.verify(token, 'this-is-my-secret');
};

module.exports = {
  createToken,
  verify,
};
